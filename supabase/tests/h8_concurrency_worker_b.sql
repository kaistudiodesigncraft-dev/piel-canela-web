\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub', (
  select profile.user_id::text from public.profiles profile
  join auth.users account on account.id=profile.user_id
  where profile.is_active and profile.role in ('admin','manager') limit 1
), false);
set role authenticated;
do $worker$
begin
  perform public.manage_service_package_session(
    '88100000-0000-4000-8000-000000000005','reserve',
    '88100000-0000-4000-8000-000000000008',null,
    ((current_date+15)+time '11:00') at time zone 'America/Argentina/Cordoba',now(),null
  );
  insert into public.h8_concurrency_results(worker,outcome) values('B','success');
exception when others then
  insert into public.h8_concurrency_results(worker,outcome) values('B',sqlerrm);
end;
$worker$;
