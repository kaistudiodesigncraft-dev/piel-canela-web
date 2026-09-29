-- Additive infrastructure only: installing this migration does NOT merge profiles.
begin;

create table public.professional_identity_reconciliations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.professionals(id) on delete restrict,
  target_id uuid not null references public.professionals(id) on delete restrict,
  actor_id uuid not null references auth.users(id),
  reason text not null check (length(trim(reason)) between 10 and 1000),
  backup_reference text not null check (length(trim(backup_reference)) between 10 and 500),
  before_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (source_id <> target_id)
);
alter table public.professional_identity_reconciliations enable row level security;
revoke all on public.professional_identity_reconciliations from anon, authenticated;
grant select on public.professional_identity_reconciliations to authenticated;
create policy owner_read_identity_reconciliations on public.professional_identity_reconciliations
  for select to authenticated using (public.is_owner(auth.uid()));

create or replace function public.reconcile_professional_identity(
  source_professional_id uuid, target_professional_id uuid,
  restore_reason text, verified_backup_reference text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  source_profile public.professionals%rowtype;
  target_profile public.professionals%rowtype;
  snapshot jsonb;
  reconciliation_id uuid;
begin
  if not public.is_owner(auth.uid()) then
    raise exception using errcode = '42501', message = 'owner_required';
  end if;
  if source_professional_id is null or target_professional_id is null
    or source_professional_id = target_professional_id
    or coalesce(length(trim(restore_reason)), 0) not between 10 and 1000
    or coalesce(length(trim(verified_backup_reference)), 0) not between 10 and 500 then
    raise exception using errcode = '22023', message = 'identity_confirmation_required';
  end if;
  -- Short maintenance transaction: block concurrent bookings/profile edits while
  -- checking and remapping identities. The exclusion constraint remains enabled.
  lock table public.professionals, public.professional_specialties,
    public.treatment_professionals, public.treatments,
    public.professional_availability_rules, public.professional_availability_exceptions,
    public.bookings, public.professional_identity_reconciliations in share row exclusive mode;
  select * into source_profile from public.professionals where id = source_professional_id;
  select * into target_profile from public.professionals where id = target_professional_id;
  if source_profile.id is null or target_profile.id is null or not target_profile.is_active then
    raise exception using errcode = '22023', message = 'professional_not_available';
  end if;
  if exists (select 1 from public.professional_identity_reconciliations
    where source_id in (source_professional_id, target_professional_id)
       or target_id = source_professional_id) then
    raise exception using errcode = '22023', message = 'identity_already_reconciled';
  end if;
  if exists (
    select 1 from public.bookings a join public.bookings b
      on a.professional_id = source_professional_id and b.professional_id = target_professional_id
      and a.status in ('pending','awaiting_deposit','confirmed')
      and b.status in ('pending','awaiting_deposit','confirmed')
      and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
  ) then
    raise exception using errcode = '23P01', message = 'professional_identity_booking_conflict';
  end if;
  -- Never union custom weekly schedules silently: doing so can broaden access.
  -- A separate reviewed schedule decision is needed before reconciling these IDs.
  if exists (select 1 from public.professional_availability_rules
    where professional_id in (source_professional_id,target_professional_id) and is_active) then
    raise exception using errcode = '22023', message = 'professional_schedule_review_required';
  end if;
  if exists (
    select 1 from public.professional_availability_exceptions e join public.bookings b
      on b.professional_id in (source_professional_id,target_professional_id)
      and b.status in ('pending','awaiting_deposit','confirmed')
      and tstzrange(e.starts_at,e.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)')
    where e.professional_id in (source_professional_id,target_professional_id) and e.kind = 'blocked'
  ) then
    raise exception using errcode = '23P01', message = 'professional_identity_block_conflict';
  end if;
  snapshot := jsonb_build_object(
    'source', to_jsonb(source_profile), 'target', to_jsonb(target_profile),
    'bookings', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.bookings b where professional_id in (source_professional_id,target_professional_id)),
    'treatments', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.treatments t where professional_id in (source_professional_id,target_professional_id)),
    'assignments', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.treatment_professionals t where professional_id in (source_professional_id,target_professional_id)),
    'specialties', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_specialties t where professional_id in (source_professional_id,target_professional_id)),
    'rules', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_availability_rules t where professional_id in (source_professional_id,target_professional_id)),
    'exceptions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.professional_availability_exceptions t where professional_id in (source_professional_id,target_professional_id))
  );
  insert into public.professional_identity_reconciliations(source_id,target_id,actor_id,reason,backup_reference,before_snapshot)
    values (source_professional_id,target_professional_id,auth.uid(),trim(restore_reason),trim(verified_backup_reference),snapshot)
    returning id into reconciliation_id;
  insert into public.professional_specialties(professional_id,specialty_id)
    select target_professional_id,specialty_id from public.professional_specialties where professional_id=source_professional_id
    union select target_professional_id,source_profile.specialty_id
    on conflict do nothing;
  insert into public.treatment_professionals(treatment_id,professional_id,is_active,display_order)
    select treatment_id,target_professional_id,is_active,display_order from public.treatment_professionals where professional_id=source_professional_id
    on conflict (treatment_id,professional_id) do update set is_active = public.treatment_professionals.is_active or excluded.is_active;
  update public.treatment_professionals set is_active=false where professional_id=source_professional_id;
  update public.treatments set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.professional_availability_exceptions set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.bookings set professional_id=target_professional_id where professional_id=source_professional_id;
  update public.professionals set is_active=false where id=source_professional_id;
  insert into public.audit_log(actor_id,table_name,record_id,action,new_data)
    values(auth.uid(),'professional_identity_reconciliations',reconciliation_id,'insert',
      jsonb_build_object('source_id',source_professional_id,'target_id',target_professional_id,'reason',trim(restore_reason)));
  return reconciliation_id;
end;
$$;
revoke all on function public.reconcile_professional_identity(uuid,uuid,text,text) from public, anon;
grant execute on function public.reconcile_professional_identity(uuid,uuid,text,text) to authenticated;

create or replace function public.prevent_archived_identity_reactivation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active and exists (select 1 from public.professional_identity_reconciliations where source_id=new.id) then
    raise exception using errcode='22023',message='professional_identity_archived';
  end if;
  return new;
end;
$$;
create trigger professional_identity_archive_guard before update of is_active on public.professionals
  for each row execute function public.prevent_archived_identity_reactivation();
commit;
