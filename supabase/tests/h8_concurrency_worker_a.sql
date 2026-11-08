\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','88100000-0000-4000-8000-000000000098',false);
set role authenticated;
do $worker$
begin
  perform public.manage_service_package_session(
    '88100000-0000-4000-8000-000000000005','reserve',
    '88100000-0000-4000-8000-000000000007',null,
    ((current_date+15)+time '10:00') at time zone 'America/Argentina/Cordoba',now(),null
  );
  insert into public.h8_concurrency_results(worker,outcome) values('A','success');
exception when others then
  insert into public.h8_concurrency_results(worker,outcome) values('A',sqlerrm);
end;
$worker$;
