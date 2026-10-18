-- Disable the new endpoints without deleting functions, tables or business data.
-- Roll back the associated application version at the same time.
-- This does not undo operations explicitly performed after activation.
begin;
revoke all on function public.remove_monthly_special_safely(uuid,timestamptz,text) from authenticated;
revoke all on function public.remove_treatment_with_specials(uuid,text,uuid,timestamptz,jsonb,text) from authenticated;
commit;
