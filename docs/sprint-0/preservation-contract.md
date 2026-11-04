# Contrato de preservación — Sprint 0

Este contrato es obligatorio para cualquier sprint posterior. La referencia canónica es `docs/sprint-0/baseline.json`, capturada el 2026-10-28.

## Comando de control

Contra el respaldo:

```powershell
node --no-warnings scripts/verify-baseline.ts --snapshot "backups/sprint-0/2026-10-28_013257"
```

Contra producción, con credenciales inyectadas solo en el proceso de servidor:

```powershell
$env:SPRINT0_SUPABASE_URL="https://dlrdlwjighvcyhirwgfu.supabase.co"
$env:SPRINT0_SUPABASE_SERVER_KEY="<clave-servidor-temporal>"
node --no-warnings scripts/verify-baseline.ts
Remove-Item Env:SPRINT0_SUPABASE_SERVER_KEY
```

El script permite registros **agregados**, pero sale con código distinto de cero ante registros **modificados** o **eliminados** respecto de la línea base. No escribe en Supabase.

## Invariantes

| Invariante | Verificación | Resultado exigido |
|---|---|---|
| ID y slug del tratamiento se conservan | fingerprint de `treatments/a1f1196c-...` | `igual` |
| Los 21 IDs de zona se conservan | fingerprints de `depilation_zones` | ningún `eliminado` |
| Los 14 IDs de combo se conservan | fingerprints de `treatment_combos` | ningún `eliminado` |
| El slug público sigue siendo `depilacion` | `baseline.depilation.treatment.slug` y smoke HTTP | `depilacion`, respuesta 200 |
| Ningún precio/duración existente cambia sin autorización | fingerprints y diff de zonas/combos | ningún `modificado` |
| Las 47 relaciones combo-zona se mantienen | fingerprints compuestos `combo_id::zone_id` | ningún `modificado`/`eliminado` |
| Los extras históricos se conservan | fingerprints de extras y vínculos | ningún `modificado`/`eliminado` |
| Las reservas mantienen sus snapshots | fingerprints de `bookings` | ningún `modificado`/`eliminado` |
| No aparecen referencias rotas | consulta de integridad usada en baseline | lista vacía |
| Frecuencia mensual de Depilación se conserva | tratamiento: `monthly`, jueves, `[3]` | valores idénticos |
| Configuración y políticas no cambian accidentalmente | fingerprint de `business_settings` | `igual` |
| Contenido publicado/drafts/revisiones se conserva | hashes de `site_content*` | sin modificación/eliminación |
| Registros incompletos permanecen intactos | fingerprints, incluso nulos y ceros | no completar automáticamente |
| URLs actuales continúan respondiendo | `GET /tratamientos/depilacion` y `GET /reservar?treatmentId=...` | 200/redirect esperado, nunca 404 |
| Toda evolución de esquema es aditiva y reversible | revisión SQL | sin `DROP`, `TRUNCATE`, conversión ni borrado masivo |

## Reglas para próximos sprints

1. Ejecutar el verificador antes de modificar código o esquema.
2. Crear un backup nuevo y verificado antes de cualquier migración.
3. Mostrar SQL y rollback antes de aplicar una migración.
4. Nunca transformar Depilación para convertirla en un modelo nuevo. El modelo nuevo debe convivir con estos registros.
5. Si un nuevo producto usa ítems/combos, debe referenciar su propio catálogo; no debe reutilizar implícitamente las 21 zonas globales.
6. No recalcular snapshots históricos aunque cambien precios, duración o descuento.
7. No reasignar combos, zonas, reservas o profesionales por inferencia de nombres.
8. Las diferencias aditivas deben estar explicadas y autorizadas; las modificadas/eliminadas son bloqueantes.

## Consultas de integridad mínimas

```sql
-- Solo lectura. Debe devolver cero filas.
select b.id, b.combo_id
from public.bookings b
left join public.treatment_combos c on c.id = b.combo_id
where b.combo_id is not null and c.id is null;

select l.combo_id, l.zone_id
from public.treatment_combo_zones l
left join public.treatment_combos c on c.id = l.combo_id
left join public.depilation_zones z on z.id = l.zone_id
where c.id is null or z.id is null;
```

## Evidencia inicial

- 31 tablas verificadas.
- 2.310 filas origen y 2.310 filas exportadas.
- 0 diferencias en la primera corrida.
- 0 referencias rotas.
- `backups/` está ignorado por Git.

