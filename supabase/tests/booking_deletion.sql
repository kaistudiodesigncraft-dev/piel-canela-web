\set ON_ERROR_STOP on
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values('13000000-0000-0000-0000-000000000001','authenticated','authenticated','booking-delete@example.test','',now(),'{}','{}');
insert into public.profiles(user_id,full_name,role,is_active)
values('13000000-0000-0000-0000-000000000001','Booking delete test owner','admin',true);
insert into public.specialties(id,name,slug,description,is_active,display_order)
values('33000000-0000-0000-0000-000000000001','Booking delete specialty','booking-delete-specialty','Test',true,999);
insert into public.professionals(id,specialty_id,full_name,is_active,display_order)
values('43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','Booking delete professional',true,999);
insert into public.treatments(
  id,category_id,specialty_id,professional_id,name,slug,short_description,description,
  price_cents,duration_minutes,buffer_minutes,start_interval_minutes,is_active,display_order
)
select
  '53000000-0000-0000-0000-000000000001',category.id,'33000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001',
  'Booking delete treatment','booking-delete-treatment','Descripción de prueba suficientemente larga.',
  'Descripción de prueba suficientemente larga para validar el tratamiento.',1000,30,0,15,false,999
from public.treatment_categories category order by category.display_order limit 1;
insert into public.treatment_professionals(treatment_id,professional_id,is_active)
values('53000000-0000-0000-0000-000000000001','43000000-0000-0000-0000-000000000001',true);
update public.treatments set is_active=true where id='53000000-0000-0000-0000-000000000001';
insert into public.customers(id,full_name,phone,email)
values('63000000-0000-0000-0000-000000000001','Reserva de prueba','5493510000000','booking-delete@example.test');

insert into private.booking_guard_config(singleton,secret_hash)
values(true,encode(extensions.digest(repeat('e',32),'sha256'),'hex'))
on conflict(singleton) do update set secret_hash=excluded.secret_hash;

insert into public.bookings(
  id,booking_code,idempotency_key,customer_id,treatment_id,specialty_id,starts_at,ends_at,status,
  duration_snapshot_minutes,buffer_snapshot_minutes,base_price_snapshot_cents,
  applied_price_snapshot_cents,treatment_name_snapshot
)
values
('73000000-0000-0000-0000-000000000001','PC-DELETE1','74000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()-interval '2 days',now()-interval '2 days'+interval '30 minutes','expired',30,0,1000,1000,'Booking delete treatment'),
('73000000-0000-0000-0000-000000000002','PC-ACTIVE1','74000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000001','53000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001',now()+interval '2 days',now()+interval '2 days'+interval '30 minutes','confirmed',30,0,1000,1000,'Booking delete treatment');
update public.treatments set is_active=false where id='53000000-0000-0000-0000-000000000001';
insert into public.booking_status_history(booking_id,previous_status,next_status,reason)
values('73000000-0000-0000-0000-000000000001','pending','expired','Prueba automática');

select set_config('request.jwt.claims','{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
set local role authenticated;

do $$
declare blocked boolean := false;
begin
  perform public.delete_booking_if_safe('73000000-0000-0000-0000-000000000001',repeat('e',32));
  if exists(select 1 from public.bookings where id='73000000-0000-0000-0000-000000000001') then
    raise exception 'final test booking was not removed';
  end if;
  if exists(select 1 from public.booking_status_history where booking_id='73000000-0000-0000-0000-000000000001') then
    raise exception 'booking status history was not removed';
  end if;
  if not exists(
    select 1 from public.audit_log
    where table_name='bookings' and record_id='73000000-0000-0000-0000-000000000001' and action='delete'
  ) then
    raise exception 'booking deletion was not audited';
  end if;

  begin
    perform public.delete_booking_if_safe('73000000-0000-0000-0000-000000000002',repeat('e',32));
  exception when invalid_parameter_value then blocked := true; end;
  if not blocked then raise exception 'active booking deletion was accepted'; end if;
  if not exists(select 1 from public.bookings where id='73000000-0000-0000-0000-000000000002') then
    raise exception 'active booking was modified';
  end if;
end $$;

rollback;
