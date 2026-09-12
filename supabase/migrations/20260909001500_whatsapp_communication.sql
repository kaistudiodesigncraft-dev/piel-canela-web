-- Additive only. Automatic delivery stays disabled in application configuration.
create table public.treatment_message_templates (
  id uuid not null unique default gen_random_uuid(),
  treatment_id uuid not null references public.treatments(id) on delete cascade,
  event text not null check (event in ('pre_reservation','confirmation','preparation')),
  body text not null check (char_length(body) between 10 and 1800),
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (treatment_id,event)
);
alter table public.treatment_message_templates enable row level security;
grant select on public.treatment_message_templates to anon, authenticated;
create policy message_template_public_read on public.treatment_message_templates for select to anon
  using (exists(select 1 from public.treatments t where t.id=treatment_id and t.is_active));
create policy message_template_staff_read on public.treatment_message_templates for select to authenticated
  using (public.is_admin() or exists(select 1 from public.treatments t where t.id=treatment_id and t.is_active));
create trigger treatment_message_templates_audit after insert or update or delete on public.treatment_message_templates
  for each row execute function public.capture_admin_audit();

create function public.save_treatment_message_template(requested_treatment_id uuid, requested_event text, requested_body text)
returns void language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required' using errcode='42501'; end if;
  if requested_body is null or char_length(trim(requested_body)) not between 10 and 1800 then raise exception 'invalid_message'; end if;
  for token in select m[1] from regexp_matches(requested_body, '\{\{([^{}]+)\}\}', 'g') m loop
    if token <> all(array['nombre','tratamiento','combo','fecha','hora','duracion','codigo','direccion','sena']) then raise exception 'invalid_variable'; end if;
  end loop;
  if regexp_replace(requested_body,'\{\{[^{}]+\}\}','','g') ~ '[{}]' then raise exception 'invalid_variable'; end if;
  insert into public.treatment_message_templates(treatment_id,event,body)
  values(requested_treatment_id,requested_event,trim(requested_body))
  on conflict(treatment_id,event) do update set body=excluded.body,version=treatment_message_templates.version+1,updated_at=now();
end $$;
revoke all on function public.save_treatment_message_template(uuid,text,text) from public,anon;
grant execute on function public.save_treatment_message_template(uuid,text,text) to authenticated;

create table public.booking_whatsapp_consents (
  booking_id uuid primary key references public.bookings(id),
  consented_at timestamptz not null default now(),
  policy_version text not null default 'operational-whatsapp-v1',
  revoked_at timestamptz
);
create table public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  event text not null check(event in ('pre_reservation','confirmation','preparation')),
  scheduled_for timestamptz not null default now(),
  booking_starts_at timestamptz not null,
  state text not null default 'pending' check(state in ('pending','processing','sent','delivered','read','failed','uncertain','cancelled')),
  attempts integer not null default 0,
  locked_at timestamptz,
  provider_message_id text unique,
  provider_template_name text,
  provider_template_language text,
  failure_code text,
  updated_at timestamptz not null default now(),
  unique(booking_id,event,booking_starts_at)
);
create index whatsapp_outbox_due on public.whatsapp_outbox(scheduled_for) where state='pending';
alter table public.booking_whatsapp_consents enable row level security;
alter table public.whatsapp_outbox enable row level security;
grant select on public.whatsapp_outbox to authenticated;
create policy whatsapp_history_read on public.whatsapp_outbox for select to authenticated using(public.is_admin());
-- No direct browser mutations or recipient access.
grant all on public.whatsapp_outbox, public.booking_whatsapp_consents to service_role;

-- Persist signed delivery events even when Meta beats the worker response.
create table public.whatsapp_delivery_events (
  provider_message_id text not null,
  state text not null check(state in ('sent','delivered','read','failed')),
  received_at timestamptz not null default now(),
  primary key(provider_message_id,state)
);
alter table public.whatsapp_delivery_events enable row level security;
grant all on public.whatsapp_delivery_events to service_role;
create function public.reconcile_whatsapp_delivery() returns trigger language plpgsql security definer set search_path='' as $$
declare delivery text;
begin
  if new.provider_message_id is not null then
    select e.state into delivery from public.whatsapp_delivery_events e where e.provider_message_id=new.provider_message_id
      order by case e.state when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end desc limit 1;
    if delivery='read' or (delivery='delivered' and new.state<>'read')
      or (delivery='failed' and new.state not in ('delivered','read'))
      or (delivery='sent' and new.state in ('processing','uncertain')) then new.state:=delivery; end if;
  end if;
  return new;
end $$;
revoke all on function public.reconcile_whatsapp_delivery() from public,anon,authenticated;
create trigger whatsapp_delivery_reconcile before update on public.whatsapp_outbox for each row execute function public.reconcile_whatsapp_delivery();

create function public.enqueue_booking_whatsapp() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status::text in ('cancelled','expired','completed','no_show') or new.starts_at <> old.starts_at then
    update public.whatsapp_outbox set state='cancelled',updated_at=now()
    where booking_id=new.id and state='pending';
  end if;
  if new.status::text='confirmed' and old.status::text <> 'confirmed'
    and exists(select 1 from public.booking_whatsapp_consents where booking_id=new.id and revoked_at is null) then
    insert into public.whatsapp_outbox(booking_id,event,booking_starts_at) values(new.id,'confirmation',new.starts_at) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.enqueue_booking_whatsapp() from public,anon,authenticated;
create trigger booking_whatsapp_events after update on public.bookings for each row execute function public.enqueue_booking_whatsapp();

create function public.create_booking_with_communication(
  requested_treatment_id uuid, requested_combo_id uuid, requested_monthly_special_id uuid,
  requested_starts_at timestamptz, requested_idempotency_key uuid, customer_full_name text, customer_phone text,
  customer_email text default null, customer_notes text default null, request_guard_nonce uuid default null,
  request_guard_fingerprint text default null, request_guard_secret text default null, requested_whatsapp_opt_in boolean default false
) returns table(booking_id uuid,booking_code text,status public.booking_status)
language plpgsql security definer set search_path='' as $$
declare result record; already_created boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(requested_idempotency_key::text, 915));
  select exists(select 1 from public.bookings b where b.idempotency_key=requested_idempotency_key) into already_created;
  select * into result from public.create_booking_for_selection(requested_treatment_id,requested_combo_id,requested_monthly_special_id,
    requested_starts_at,requested_idempotency_key,customer_full_name,customer_phone,customer_email,customer_notes,
    request_guard_nonce,request_guard_fingerprint,request_guard_secret);
  if requested_whatsapp_opt_in and not already_created and result.booking_id is not null then
    if regexp_replace(customer_phone,'[ +().-]','','g') !~ '^[1-9][0-9]{7,14}$' then raise exception 'invalid_whatsapp_phone' using errcode='22023'; end if;
    insert into public.booking_whatsapp_consents(booking_id) values(result.booking_id) on conflict do nothing;
    insert into public.whatsapp_outbox(booking_id,event,booking_starts_at)
    select b.id,'pre_reservation',b.starts_at from public.bookings b where b.id=result.booking_id on conflict do nothing;
  end if;
  return query select result.booking_id,result.booking_code,result.status;
end $$;
revoke all on function public.create_booking_with_communication(uuid,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid,text,text,boolean) from public,authenticated;
grant execute on function public.create_booking_with_communication(uuid,uuid,uuid,timestamptz,uuid,text,text,text,text,uuid,text,text,boolean) to anon;

create function public.claim_whatsapp_outbox() returns setof public.whatsapp_outbox
language plpgsql security definer set search_path='' as $$
begin
  -- A crashed worker may have sent a message: never blindly retry its lease.
  update public.whatsapp_outbox set state='uncertain',failure_code='worker_interrupted',updated_at=now()
    where state='processing' and locked_at < now()-interval '5 minutes';
  update public.whatsapp_outbox o set state='cancelled',updated_at=now()
  where o.state='pending' and (not exists(select 1 from public.booking_whatsapp_consents c where c.booking_id=o.booking_id and c.revoked_at is null)
    or not exists(select 1 from public.bookings b where b.id=o.booking_id and b.starts_at=o.booking_starts_at and b.starts_at>now()
      and b.status::text in ('pending','awaiting_deposit','confirmed')
      and ((o.event='pre_reservation' and b.status::text in ('pending','awaiting_deposit'))
        or (o.event<>'pre_reservation' and b.status::text='confirmed'))));
  return query update public.whatsapp_outbox set state='processing',attempts=attempts+1,locked_at=now(),updated_at=now()
  where id in(select id from public.whatsapp_outbox where state='pending' and scheduled_for<=now() and attempts<3 order by scheduled_for for update skip locked limit 10)
  returning *;
end $$;
revoke all on function public.claim_whatsapp_outbox() from public,anon,authenticated;
grant execute on function public.claim_whatsapp_outbox() to service_role;

create function public.retry_whatsapp_message(requested_id uuid, requested_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare previous_provider_id text;
begin
  if not public.is_admin(auth.uid()) then raise exception 'admin_required' using errcode='42501'; end if;
  if requested_reason is null or char_length(trim(requested_reason)) not between 5 and 240 then raise exception 'reason_required'; end if;
  select provider_message_id into previous_provider_id from public.whatsapp_outbox
    where id=requested_id and state='failed' and attempts<3 for update;
  -- Retire the failed attempt ID so its delivery event cannot override a new attempt.
  update public.whatsapp_outbox set state='pending',failure_code=null,provider_message_id=null,scheduled_for=now(),updated_at=now()
    where id=requested_id and state='failed' and attempts<3;
  if not found then raise exception 'retry_not_allowed'; end if;
  insert into public.audit_log(actor_id,table_name,record_id,action,new_data)
    values(auth.uid(),'whatsapp_outbox',requested_id,'update',jsonb_build_object('operation','retry','reason',trim(requested_reason),'previous_provider_id',previous_provider_id));
end $$;
revoke all on function public.retry_whatsapp_message(uuid,text) from public,anon;
grant execute on function public.retry_whatsapp_message(uuid,text) to authenticated;
