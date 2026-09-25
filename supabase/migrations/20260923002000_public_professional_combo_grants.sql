-- Public/admin grants for the professional-aware catalog and mixed depilation combos.
-- Required after column-level public hardening: RLS policies alone do not grant table/column privileges.

grant select (requires_professional_assignment)
  on public.treatments to anon;

grant select on public.treatment_professionals to anon;
grant select on public.treatment_combo_extras to anon;
grant select on public.treatment_combo_allowed_extras to anon;

grant select, insert, update, delete on public.professional_specialties to authenticated;
grant select, insert, update, delete on public.treatment_professionals to authenticated;
grant select, insert, update, delete on public.professional_availability_rules to authenticated;
grant select, insert, update, delete on public.professional_availability_exceptions to authenticated;
grant select, insert, update, delete on public.treatment_combo_extras to authenticated;
grant select, insert, update, delete on public.treatment_combo_allowed_extras to authenticated;
