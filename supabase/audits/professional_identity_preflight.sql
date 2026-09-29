-- READ ONLY. Export results securely before any reconciliation. This inventory
-- does not constitute a full backup. Names identify candidates, NEVER merge keys.
begin transaction read only;
select id, full_name, public_name, specialty_id, is_active, updated_at
from public.professionals order by full_name,id;
select * from public.professional_specialties order by professional_id,specialty_id;
select * from public.treatment_professionals order by professional_id,treatment_id;
select * from public.professional_availability_rules order by professional_id,weekday,start_time;
select id,professional_id,kind,starts_at,ends_at from public.professional_availability_exceptions order by professional_id,starts_at;
-- Include every operational overlap between distinct profiles for human review.
select a.id as booking_a,b.id as booking_b,a.professional_id as professional_a,
  b.professional_id as professional_b,a.starts_at,a.ends_at,b.starts_at as other_start,b.ends_at as other_end
from public.bookings a join public.bookings b on a.id < b.id
  and a.professional_id <> b.professional_id
  and a.status in ('pending','awaiting_deposit','confirmed')
  and b.status in ('pending','awaiting_deposit','confirmed')
  and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)');
select count(*) as bookings,md5(coalesce(string_agg(
  (to_jsonb(b)-'professional_id'-'updated_at')::text, '' order by id),'')) as booking_invariants
from public.bookings b;
commit;
