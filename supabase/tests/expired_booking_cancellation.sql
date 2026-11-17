\set ON_ERROR_STOP on
\echo 1..1

begin;

insert into public.treatment_categories(id,name,slug,short_description,icon_name,is_active)
values('0b000000-0000-4000-8000-000000000001','Cancelación vencida QA','cancelacion-vencida-qa','Categoría aislada para validar la cancelación de reservas vencidas.','UserFocus',true);
insert into public.specialties(id,name,slug,is_active)
values('0b000000-0000-4000-8000-000000000002','Cancelación vencida QA','cancelacion-vencida-qa',true);
insert into public.professionals(id,specialty_id,full_name,is_active)
values('0b000000-0000-4000-8000-000000000003','0b000000-0000-4000-8000-000000000002','Profesional QA cancelación',true);
insert into public.professional_specialties(professional_id,specialty_id)
values('0b000000-0000-4000-8000-000000000003','0b000000-0000-4000-8000-000000000002');
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  duration_minutes,buffer_minutes,price_cents,is_active
) values (
  '0b000000-0000-4000-8000-000000000004',
  '0b000000-0000-4000-8000-000000000001',
  '0b000000-0000-4000-8000-000000000002',
  '0b000000-0000-4000-8000-000000000003',
  'Tratamiento QA cancelación','tratamiento-qa-cancelacion','Tratamiento aislado para validar cancelación.',
  'Tratamiento local para validar que una pre-reserva vencida futura pueda cancelarse con auditoría.',
  60,0,100000,false
);
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('0b000000-0000-4000-8000-000000000004','0b000000-0000-4000-8000-000000000003',true);
update public.treatments
set is_active=true
where id='0b000000-0000-4000-8000-000000000004';
insert into public.customers(id,full_name,phone)
values
  ('0b000000-0000-4000-8000-000000000005','Cliente QA futuro','3510000011'),
  ('0b000000-0000-4000-8000-000000000006','Cliente QA pasado','3510000012');
insert into public.bookings(
  id,idempotency_key,customer_id,treatment_id,specialty_id,professional_id,
  starts_at,ends_at,duration_snapshot_minutes,buffer_snapshot_minutes,
  base_price_snapshot_cents,applied_price_snapshot_cents,treatment_name_snapshot,status
) values
  (
    '0b000000-0000-4000-8000-000000000007','0b000000-0000-4000-8000-000000000008',
    '0b000000-0000-4000-8000-000000000005','0b000000-0000-4000-8000-000000000004',
    '0b000000-0000-4000-8000-000000000002','0b000000-0000-4000-8000-000000000003',
    now()+interval '30 days',now()+interval '30 days 1 hour',60,0,100000,100000,
    'Tratamiento QA cancelación','expired'
  ),
  (
    '0b000000-0000-4000-8000-000000000009','0b000000-0000-4000-8000-00000000000a',
    '0b000000-0000-4000-8000-000000000006','0b000000-0000-4000-8000-000000000004',
    '0b000000-0000-4000-8000-000000000002','0b000000-0000-4000-8000-000000000003',
    now()-interval '2 days',now()-interval '2 days'+interval '1 hour',60,0,100000,100000,
    'Tratamiento QA cancelación','expired'
  );

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('0b000000-0000-4000-8000-0000000000aa','authenticated','authenticated','cancelacion-vencida-qa@example.invalid','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('0b000000-0000-4000-8000-0000000000aa','QA cancelación vencida','manager',true);

select setval(pg_get_serial_sequence('public.booking_status_history', 'id'), greatest(coalesce((select max(id) from public.booking_status_history), 0), 1), exists(select 1 from public.booking_status_history));

set local role authenticated;
select set_config('request.jwt.claim.sub','0b000000-0000-4000-8000-0000000000aa',true);
select set_config('request.jwt.claims','{"sub":"0b000000-0000-4000-8000-0000000000aa","role":"authenticated"}',true);

do $$
declare
  past_booking_blocked boolean := false;
begin
  perform * from public.transition_admin_booking(
    '0b000000-0000-4000-8000-000000000007',
    'cancelled'::public.booking_status,
    'La persona no confirmó la seña.'
  );

  begin
    perform * from public.transition_admin_booking(
      '0b000000-0000-4000-8000-000000000009',
      'cancelled'::public.booking_status,
      'El horario ya pasó.'
    );
  exception when invalid_parameter_value then
    past_booking_blocked := true;
  end;

  if not past_booking_blocked then
    raise exception 'past_expired_booking_was_cancelled';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select status from public.bookings where id='0b000000-0000-4000-8000-000000000007') <> 'cancelled'::public.booking_status then
    raise exception 'future_expired_booking_was_not_cancelled';
  end if;
  if (select status_reason from public.bookings where id='0b000000-0000-4000-8000-000000000007') <> 'La persona no confirmó la seña.' then
    raise exception 'cancellation_reason_was_not_saved';
  end if;
  if not exists (
    select 1 from public.booking_status_history
    where booking_id='0b000000-0000-4000-8000-000000000007'
      and previous_status='expired'::public.booking_status
      and next_status='cancelled'::public.booking_status
      and reason='La persona no confirmó la seña.'
  ) then
    raise exception 'cancellation_history_was_not_written';
  end if;
end;
$$;

rollback;
\echo ok 1 - future expired bookings can be cancelled, while past bookings remain protected
