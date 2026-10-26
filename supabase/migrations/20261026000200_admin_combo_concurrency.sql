-- Prevent one admin session from silently overwriting a combo edited elsewhere.
-- Additive: existing data, functions and callers remain unchanged.
begin;

create or replace function public.save_depilation_combo_v4(
  requested_combo_id uuid,
  requested_treatment_id uuid,
  requested_name text,
  requested_description text,
  requested_audience public.depilation_audience,
  requested_mode public.combo_mode,
  requested_session_count integer,
  requested_fixed_price_cents integer,
  requested_appointment_duration_minutes integer,
  requested_validity_days integer,
  requested_display_order integer,
  requested_is_active boolean,
  requested_zone_ids jsonb,
  requested_pricing_mode public.combo_pricing_mode,
  requested_discount_percent numeric,
  requested_tier_min_items integer,
  requested_tier_discount_percent numeric,
  requested_allow_public_extras boolean,
  requested_extra_ids jsonb,
  expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_updated_at timestamptz;
begin
  if not public.is_admin(auth.uid()) then
    raise exception using errcode = '42501', message = 'admin_required';
  end if;

  if requested_combo_id is not null then
    select combo.updated_at
      into current_updated_at
      from public.treatment_combos combo
      where combo.id = requested_combo_id
        and combo.treatment_id = requested_treatment_id
      for update;

    if current_updated_at is null then
      raise exception using errcode = 'P0002', message = 'combo_not_found';
    end if;
    if expected_updated_at is null or current_updated_at is distinct from expected_updated_at then
      raise exception using errcode = '40001', message = 'combo_version_conflict';
    end if;
  end if;

  return public.save_depilation_combo_v3(
    requested_combo_id,
    requested_treatment_id,
    requested_name,
    requested_description,
    requested_audience,
    requested_mode,
    requested_session_count,
    requested_fixed_price_cents,
    requested_appointment_duration_minutes,
    requested_validity_days,
    requested_display_order,
    requested_is_active,
    requested_zone_ids,
    requested_pricing_mode,
    requested_discount_percent,
    requested_tier_min_items,
    requested_tier_discount_percent,
    requested_allow_public_extras,
    requested_extra_ids
  );
end;
$$;

revoke all on function public.save_depilation_combo_v4(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb,timestamptz
) from public,anon;
grant execute on function public.save_depilation_combo_v4(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb,timestamptz
) to authenticated;

comment on function public.save_depilation_combo_v4(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb,timestamptz
) is 'Atomic combo save with optimistic locking to prevent silent overwrites between admin sessions.';

commit;
