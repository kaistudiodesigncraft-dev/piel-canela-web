-- Exact rollback for the links and combo flags introduced by
-- 20261111000100_restore_depilation_combo_extras.sql.
begin;

delete from public.treatment_combo_allowed_extras allowed
using private.depilation_extra_restore_manifest manifest
where manifest.migration_key = '20261111000100'
  and allowed.combo_id = manifest.combo_id
  and allowed.extra_id = manifest.extra_id;

update public.treatment_combos combo
set allow_public_extras = previous.combo_was_enabled,
    updated_at = now()
from (
  select combo_id, bool_or(combo_was_enabled) as combo_was_enabled
  from private.depilation_extra_restore_manifest
  where migration_key = '20261111000100'
  group by combo_id
) previous
where combo.id = previous.combo_id;

delete from private.depilation_extra_restore_manifest
where migration_key = '20261111000100';

drop table if exists private.depilation_extra_restore_manifest;

commit;
