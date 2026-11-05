begin;

grant service_package_rpc_executor to postgres;
alter function public.register_service_package_purchase_v2(uuid,text,uuid)
  owner to postgres;
alter function public.update_service_package_payment(uuid,text)
  owner to postgres;
alter function public.extend_service_package_validity_v2(uuid,timestamptz,integer,text,uuid)
  owner to postgres;
revoke service_package_rpc_executor from postgres;

drop function public.extend_service_package_validity_v2(uuid,timestamptz,integer,text,uuid);
drop function public.update_service_package_payment(uuid,text);
drop function public.register_service_package_purchase_v2(uuid,text,uuid);

commit;
