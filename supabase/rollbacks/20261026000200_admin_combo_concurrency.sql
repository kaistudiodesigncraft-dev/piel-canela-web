begin;

revoke all on function public.save_depilation_combo_v4(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb,timestamptz
) from public,anon,authenticated;
drop function if exists public.save_depilation_combo_v4(
  uuid,uuid,text,text,public.depilation_audience,public.combo_mode,integer,integer,integer,
  integer,integer,boolean,jsonb,public.combo_pricing_mode,numeric,integer,numeric,boolean,jsonb,timestamptz
);

commit;
