-- Operations and scalability: expose only the public booking horizon so the
-- calendar can represent the same rule already enforced by get_available_slots.

grant select (maximum_advance_days)
  on public.business_settings to anon;
