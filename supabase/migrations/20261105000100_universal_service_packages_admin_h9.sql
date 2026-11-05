-- H9: additive admin operations for universal service packages.
-- H8 functions and all legacy package objects remain unchanged.

begin;

create function public.register_service_package_purchase_v2(
  requested_booking_id uuid,
  requested_payment_status text,
  requested_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  result_payload jsonb;
  previous_status public.booking_status;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  result_payload := public.register_service_package_purchase(
    requested_booking_id,
    requested_payment_status,
    requested_idempotency_key
  );
  if result_payload->>'paymentStatus' is distinct from requested_payment_status then
    raise exception using errcode = '22023', message = 'package_purchase_payment_conflict';
  end if;
  if requested_payment_status in ('deposit_paid', 'paid_in_full') then
    select status into previous_status
    from public.bookings where id = requested_booking_id for update;
    if previous_status in ('pending', 'awaiting_deposit') then
      update public.bookings set
        status = 'confirmed',
        confirmed_at = coalesce(confirmed_at, now()),
        deposit_confirmed_at = coalesce(deposit_confirmed_at, now()),
        status_changed_at = now(),
        status_changed_by = auth.uid(),
        status_reason = 'Pago de paquete confirmado'
      where id = requested_booking_id;
      insert into public.booking_status_history(
        booking_id, previous_status, next_status, reason, actor_id
      ) values (
        requested_booking_id, previous_status, 'confirmed',
        'Pago de paquete confirmado', auth.uid()
      );
    end if;
  end if;
  return result_payload;
end;
$function$;

create function public.update_service_package_payment(
  requested_package_id uuid,
  requested_payment_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  package_row public.service_package_contracts%rowtype;
  booking_status_before public.booking_status;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_payment_status not in ('deposit_paid', 'paid_in_full') then
    raise exception using errcode = '22023', message = 'package_payment_status_invalid';
  end if;

  select * into package_row from public.service_package_contracts
  where id = requested_package_id for update;
  if package_row.id is null then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;
  if package_row.payment_status = 'paid_in_full'
    or (package_row.payment_status = 'deposit_paid' and requested_payment_status = 'deposit_paid') then
    return jsonb_build_object(
      'packageId', package_row.id,
      'paymentStatus', package_row.payment_status
    );
  end if;
  if package_row.payment_status = 'deposit_paid' and requested_payment_status <> 'paid_in_full' then
    raise exception using errcode = '22023', message = 'package_payment_regression_not_allowed';
  end if;

  update public.service_package_contracts set
    payment_status = requested_payment_status,
    deposit_paid_at = case
      when requested_payment_status = 'deposit_paid' then coalesce(deposit_paid_at, now())
      else deposit_paid_at
    end,
    paid_in_full_at = case
      when requested_payment_status = 'paid_in_full' then now()
      else null
    end
  where id = package_row.id
  returning * into package_row;

  select status into booking_status_before from public.bookings
  where id = package_row.initial_booking_id for update;
  if booking_status_before in ('pending', 'awaiting_deposit') then
    update public.bookings set
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now()),
      deposit_confirmed_at = coalesce(deposit_confirmed_at, now()),
      status_changed_at = now(),
      status_changed_by = auth.uid(),
      status_reason = 'Pago de paquete confirmado'
    where id = package_row.initial_booking_id;
    insert into public.booking_status_history(
      booking_id, previous_status, next_status, reason, actor_id
    ) values (
      package_row.initial_booking_id, booking_status_before, 'confirmed',
      'Pago de paquete confirmado', auth.uid()
    );
  end if;

  return jsonb_build_object(
    'packageId', package_row.id,
    'paymentStatus', package_row.payment_status
  );
end;
$function$;

create function public.extend_service_package_validity_v2(
  requested_package_id uuid,
  requested_expected_validity_until timestamptz,
  requested_additional_days integer,
  requested_reason text,
  requested_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  existing_operation public.service_package_operations%rowtype;
  package_row public.service_package_contracts%rowtype;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;
  if requested_expected_validity_until is null or requested_idempotency_key is null then
    raise exception using errcode = '22023', message = 'package_extension_input_invalid';
  end if;

  select * into existing_operation
  from public.service_package_operations
  where idempotency_key = requested_idempotency_key;
  if existing_operation.id is not null then
    if existing_operation.package_id <> requested_package_id
      or existing_operation.operation <> 'extend' then
      raise exception using errcode = '22023', message = 'idempotency_key_conflict';
    end if;
    return existing_operation.result;
  end if;

  select * into package_row
  from public.service_package_contracts
  where id = requested_package_id
  for update;
  if package_row.id is null then
    raise exception using errcode = 'P0002', message = 'package_not_found';
  end if;
  if package_row.validity_until is distinct from requested_expected_validity_until then
    raise exception using errcode = '40001', message = 'package_validity_changed';
  end if;

  return public.extend_service_package_validity(
    requested_package_id,
    requested_additional_days,
    requested_reason,
    requested_idempotency_key
  );
end;
$function$;

revoke all on function public.register_service_package_purchase_v2(uuid,text,uuid)
  from public, anon, authenticated;
revoke all on function public.update_service_package_payment(uuid,text)
  from public, anon, authenticated;
revoke all on function public.extend_service_package_validity_v2(uuid,timestamptz,integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.register_service_package_purchase_v2(uuid,text,uuid)
  to authenticated;
grant execute on function public.update_service_package_payment(uuid,text)
  to authenticated;
grant execute on function public.extend_service_package_validity_v2(uuid,timestamptz,integer,text,uuid)
  to authenticated;

grant service_package_rpc_executor to postgres;
grant create on schema public to service_package_rpc_executor;
alter function public.register_service_package_purchase_v2(uuid,text,uuid)
  owner to service_package_rpc_executor;
alter function public.update_service_package_payment(uuid,text)
  owner to service_package_rpc_executor;
alter function public.extend_service_package_validity_v2(uuid,timestamptz,integer,text,uuid)
  owner to service_package_rpc_executor;
revoke create on schema public from service_package_rpc_executor;
revoke service_package_rpc_executor from postgres;

commit;
