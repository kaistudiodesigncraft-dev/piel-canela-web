-- LOCAL ISOLATED DATABASE ONLY. No production execution. All rows roll back.
\set ON_ERROR_STOP on
\echo 1..1
begin;

insert into public.treatment_categories(id, name, slug, short_description, icon_name, is_active)
values('2a000000-0000-4000-8000-000000000001', 'H3 QA', 'h3-qa', 'Prueba aislada', 'UserFocus', true);
insert into public.specialties(id, name, slug, is_active)
values('3a000000-0000-4000-8000-000000000001', 'H3 QA', 'h3-qa', true);
insert into public.professionals(id, specialty_id, full_name, is_active)
values('4a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001', 'H3 QA professional', true);
insert into public.professional_specialties(professional_id, specialty_id)
values('4a000000-0000-4000-8000-000000000001', '3a000000-0000-4000-8000-000000000001');

insert into public.treatments(
  id, category_id, specialty_id, professional_id, name, slug,
  short_description, description, duration_minutes, buffer_minutes,
  start_interval_minutes, price_cents, selection_mode,
  requires_professional_assignment, is_active, config_enabled, booking_config
) values (
  '5a000000-0000-4000-8000-000000000001',
  '2a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000001',
  '4a000000-0000-4000-8000-000000000001',
  'H3 configurable', 'h3-configurable', 'Descripción suficiente',
  'Tratamiento aislado para verificar la reserva configurable.',
  30, 15, 30, 300000, 'simple', true, false, false,
  '{
    "version": 1,
    "mode": "combos_with_addons",
    "optionsLabel": {"singular": "opción", "plural": "opciones"},
    "selectionMode": "multiple",
    "minSelections": 0,
    "maxSelections": null,
    "allowLooseOptions": true,
    "allowCombos": true,
    "allowAddons": true,
    "priceRule": {
      "type": "sum_with_volume_discount",
      "minOptions": 2,
      "discountPercent": 10,
      "appliesTo": "loose_options_only"
    },
    "durationRule": {"type": "combo_plus_addons"}
  }'::jsonb
);
insert into public.treatment_professionals(treatment_id, professional_id, is_active)
values('5a000000-0000-4000-8000-000000000001', '4a000000-0000-4000-8000-000000000001', true);
update public.treatments set is_active = true
where id = '5a000000-0000-4000-8000-000000000001';

-- A local legacy fixture proves the branch contract without depending on
-- production Depilation rows or protected backup data.
insert into public.treatments(
  id, category_id, specialty_id, professional_id, name, slug,
  short_description, description, duration_minutes, buffer_minutes,
  start_interval_minutes, price_cents, selection_mode,
  requires_professional_assignment, is_active, config_enabled, booking_config
) values (
  '5a000000-0000-4000-8000-000000000002',
  '2a000000-0000-4000-8000-000000000001',
  '3a000000-0000-4000-8000-000000000001',
  '4a000000-0000-4000-8000-000000000001',
  'H3 legacy', 'h3-legacy', 'Flujo legacy aislado suficiente',
  'Tratamiento local para comprobar que el motor universal no lo absorbe.',
  30, 0, 30, 100000, 'simple', true, false, false, null
);
insert into public.treatment_professionals(treatment_id, professional_id, is_active)
values('5a000000-0000-4000-8000-000000000002', '4a000000-0000-4000-8000-000000000001', true);
update public.treatments set is_active=true
where id='5a000000-0000-4000-8000-000000000002';

insert into public.treatment_options(
  id, treatment_id, name, price_cents, duration_minutes, display_order, is_active
) values
('6a000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', 'Incluida', 50000, 10, 1, true),
('6a000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000001', 'Adicional A', 100000, 15, 2, true),
('6a000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000001', 'Adicional B', 200000, 20, 3, true);
insert into public.treatment_option_combos(
  id, treatment_id, name, kind, price_cents, duration_minutes, session_count, is_active
) values(
  '7a000000-0000-4000-8000-000000000001',
  '5a000000-0000-4000-8000-000000000001',
  'Combo H3', 'combo', 300000, 30, 1, true
);
insert into public.treatment_option_combo_items(
  id, treatment_id, combo_id, option_id, role, display_order
) values
('8a000000-0000-4000-8000-000000000001', '5a000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001', 'included', 1),
('8a000000-0000-4000-8000-000000000002', '5a000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000002', 'addon', 2),
('8a000000-0000-4000-8000-000000000003', '5a000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000003', 'addon', 3);

-- The real panel prepares the catalog before enabling the public flow.
update public.treatments
set config_enabled = true
where id = '5a000000-0000-4000-8000-000000000001';

insert into public.availability_rules(specialty_id, weekday, start_time, end_time, is_active)
select '3a000000-0000-4000-8000-000000000001',
  extract(dow from current_date + 14)::smallint, '09:00', '18:00', true;
insert into private.booking_guard_config(singleton, secret_hash)
values(true, encode(extensions.digest(repeat('q', 64), 'sha256'), 'hex'))
on conflict(singleton) do update set secret_hash = excluded.secret_hash;

create temp table h3_quote(payload text, signature text, booking_id uuid);
grant all on h3_quote to anon;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  context_payload jsonb;
  order_payload jsonb;
  payload_text text;
  signed_text text;
  selected_slot timestamptz;
  created record;
  duplicate record;
  rejected boolean := false;
begin
  context_payload := public.get_booking_order_context_v2(
    '5a000000-0000-4000-8000-000000000001',
    '7a000000-0000-4000-8000-000000000001',
    array[
      '6a000000-0000-4000-8000-000000000002',
      '6a000000-0000-4000-8000-000000000003'
    ]::uuid[]
  );
  if context_payload->>'source' <> 'configured'
    or context_payload->'combination'->>'priceCents' <> '300000'
    or jsonb_array_length(context_payload->'options') <> 2 then
    raise exception 'generic context mismatch';
  end if;

  order_payload := jsonb_build_object(
    'items', jsonb_build_array(
      jsonb_build_object('id', '7a000000-0000-4000-8000-000000000001', 'kind', 'combination', 'name', 'Combo H3', 'priceCents', 300000, 'durationMinutes', 30),
      jsonb_build_object('id', '6a000000-0000-4000-8000-000000000002', 'kind', 'option', 'name', 'Adicional A', 'priceCents', 100000, 'durationMinutes', 15),
      jsonb_build_object('id', '6a000000-0000-4000-8000-000000000003', 'kind', 'option', 'name', 'Adicional B', 'priceCents', 200000, 'durationMinutes', 20)
    ),
    'subtotalCents', 600000,
    'looseOptionsSubtotalCents', 300000,
    'discountPercent', 10,
    'discountCents', 30000,
    'totalCents', 570000,
    'durationMinutes', 65
  );
  payload_text := jsonb_build_object(
    'purpose', 'booking-order-v2',
    'expiresAt', now() + interval '15 minutes',
    'selection', context_payload->'selection',
    'context', context_payload,
    'order', order_payload
  )::text;
  signed_text := encode(extensions.hmac(
    convert_to(payload_text, 'UTF8'),
    convert_to(encode(extensions.digest(repeat('q', 64), 'sha256'), 'hex'), 'UTF8'),
    'sha256'
  ), 'hex');
  insert into h3_quote(payload, signature) values(payload_text, signed_text);

  begin
    perform public.get_available_slots_for_booking_order_v2(
      replace(payload_text, '570000', '1'), signed_text, current_date + 14
    );
  exception when others then rejected := SQLERRM = 'invalid_quote'; end;
  if not rejected then raise exception 'tampered quote accepted'; end if;

  select starts_at into selected_slot
  from public.get_available_slots_for_booking_order_v2(payload_text, signed_text, current_date + 14)
  order by starts_at limit 1;
  if selected_slot is null then raise exception 'no generic slot'; end if;
  if exists (
    select 1 from public.get_available_slots_for_booking_order_v2(payload_text, signed_text, current_date + 14)
    where ends_at - starts_at <> interval '80 minutes'
  ) then raise exception 'generic occupied duration mismatch'; end if;

  select * into created from public.create_booking_for_booking_order_v2(
    payload_text, signed_text, selected_slot,
    '9a000000-0000-4000-8000-000000000001',
    'QA H3', '3510000000', null, null,
    gen_random_uuid(), repeat('f', 64), repeat('q', 64)
  );
  update h3_quote set booking_id = created.booking_id;
  select * into duplicate from public.create_booking_for_booking_order_v2(
    payload_text, signed_text, selected_slot,
    '9a000000-0000-4000-8000-000000000001',
    'QA H3', '3510000000', null, null,
    gen_random_uuid(), repeat('f', 64), repeat('q', 64)
  );
  if duplicate.booking_id is distinct from created.booking_id then
    raise exception 'generic idempotency failed';
  end if;

  rejected := false;
  begin
    perform public.get_booking_order_context_v2(
      '5a000000-0000-4000-8000-000000000002', null, '{}'::uuid[]
    );
  exception when others then rejected := SQLERRM = 'legacy_flow_required'; end;
  if not rejected then raise exception 'legacy treatment entered generic context'; end if;
end;
$$;
reset role;

do $$
declare stored public.bookings%rowtype;
begin
  select * into stored from public.bookings where id = (select booking_id from h3_quote);
  if stored.applied_price_snapshot_cents <> 570000
    or stored.base_price_snapshot_cents <> 600000
    or stored.duration_snapshot_minutes <> 65
    or stored.buffer_snapshot_minutes <> 15
    or stored.treatment_option_combo_id <> '7a000000-0000-4000-8000-000000000001'
    or stored.treatment_combo_id is not null
    or stored.booking_order_v2_snapshot->>'purpose' <> 'booking-order-v2' then
    raise exception 'generic snapshot mismatch';
  end if;
end;
$$;

update public.treatment_options
set price_cents = price_cents + 100
where id = '6a000000-0000-4000-8000-000000000002';
set local role anon;
do $$
declare rejected boolean := false;
begin
  begin
    perform public.get_available_slots_for_booking_order_v2(
      quote.payload, quote.signature, current_date + 14
    )
    from h3_quote quote;
  exception when others then rejected := SQLERRM = 'quote_changed'; end;
  if not rejected then raise exception 'stale generic quote accepted'; end if;
end;
$$;
reset role;

rollback;
\echo ok 1 - universal booking RPC H3 assertions passed
