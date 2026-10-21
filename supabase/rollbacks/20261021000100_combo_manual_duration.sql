-- Safe rollback for the manual combo-duration release.
-- Deliberately preserves the column and entered values so a rollback never loses client work.
begin;
revoke all on function public.save_depilation_combo_v3(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb
) from public,anon,authenticated;
drop function if exists public.save_depilation_combo_v3(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb
);
commit;
