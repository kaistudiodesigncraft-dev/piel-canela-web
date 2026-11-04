# Cierre de seguridad y verificación H5

## 1. Rol efectivo de la clave pública

**Conclusión:** el sitio público opera como `anon`. No usa `anonymous sign-ins`,
una sesión compartida ni una cookie administrativa para cargar el catálogo.

Evidencia:

- `src/lib/supabase/public-server.ts` crea un cliente solo con URL y
  `publishableKey`, con `persistSession=false`, `autoRefreshToken=false` y sin
  cookies;
- no existe ninguna llamada a `signInAnonymously` en `src/` ni `supabase/`;
- una petición productiva con únicamente la cabecera `apikey` devolvió una fila
  activa de `treatments` y cero inactivas;
- la misma petición a `bookings` fue rechazada con SQLSTATE `42501` y el mensaje
  exacto `Grant SELECT ON public.bookings TO anon`.

La frase previa “acceso efectivo de authenticated” fue una inferencia incorrecta.
La discrepancia local se originó porque el respaldo reconstruyó grants de tabla,
pero no los grants por columna de `treatments`.

Policies productivas que incluyen `authenticated` y que **habrían** resultado
legibles sin rol operativo si la clave pública trabajara como ese rol:

- `monthly_specials_public_read`: especiales activos dentro de vigencia;
- `professionals_public_read`: profesionales activos;
- `specialties_public_read`: especialidades activas;
- `categories_public_read`: categorías activas;
- `treatments_public_read`: tratamientos activos;
- `message_template_staff_read`: admin o tratamiento activo.

Varias de esas policies incluyen también `anon` de forma intencional. Las
policies administrativas `to authenticated` continúan protegidas por
`is_admin()` y no son públicas.

## 2. Función `SECURITY DEFINER` H5

Definición relevante:

```sql
create function public.is_public_configured_treatment(requested_treatment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.treatments as treatment
    where treatment.id = requested_treatment_id
      and treatment.is_active
      and treatment.config_enabled
  );
$function$;

revoke all on function public.is_public_configured_treatment(uuid)
  from public, anon, authenticated;
grant execute on function public.is_public_configured_treatment(uuid)
  to anon, authenticated;
```

Garantías verificadas:

- `search_path` vacío;
- referencias `public.treatments` con esquema explícito;
- retorno exclusivamente booleano;
- sin `EXECUTE` para `PUBLIC`; grants explícitos solo para `anon` y
  `authenticated` (el dueño conserva el derecho implícito inevitable);
- dueño `booking_catalog_policy_reader`: `NOLOGIN`, `NOSUPERUSER`,
  `NOBYPASSRLS`, sin `CREATE` en `public` y sin privilegios de escritura;
- el dueño solo puede leer `id`, `is_active` y `config_enabled` de `treatments`,
  y una policy propia limita esas filas a `is_active and config_enabled`.

SQL: `20261103000300_universal_booking_public_h5.sql` y endurecimiento
`20261103000400_universal_booking_public_h5_owner.sql`. Ambos tienen rollback.

La migración `20261103000500_universal_booking_public_columns_h5.sql` completa
el contrato del loader productivo, que usa grants por columna: concede a `anon`
solo `SELECT (booking_config, config_enabled)` sobre `treatments`. No concede
escritura, no altera RLS y tiene rollback explícito.

## 3. Origen del rol administrador

Las policies nuevas usan:

```sql
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()))
```

`is_admin` consulta `public.profiles`, no `app_metadata` ni `user_metadata`:

```sql
select exists (
  select 1
  from public.profiles
  where user_id = auth.uid()
    and is_active
    and role in ('admin', 'manager')
);
```

`authenticated` solo tiene `SELECT` sobre `profiles`; no tiene grants de
`INSERT`, `UPDATE` ni `DELETE`. El rol no es autoeditable desde el cliente.

## 4. Matriz RLS

Documento y prueba completa: `docs/sprint-1/rls-matrix-h5.md` y
`supabase/tests/universal_booking_public_h5.sql`.

Resultado: 36/36 celdas aprobadas para tres roles, tres tablas y cuatro
operaciones. La prueba termina con `ROLLBACK`.

## 5. Desglose de las 96 diferencias informativas

La clasificación automática las llamó “actividad”, pero el desglose por origen
demuestra que las 96 pertenecen exclusivamente a H2–H5:

| Origen | Cantidad | Composición |
|---|---:|---|
| H2 | 62 | 6 policies, 29 constraints, 6 triggers y 21 filas proyectadas con `config_enabled=false` |
| H3 | 21 | 5 funciones, 13 ACL de función y 3 constraints de snapshot |
| H4 | 9 | 3 funciones, 4 ACL y 2 triggers de protección |
| H5 inicial | 4 | 1 función y 3 ACL explícitas/propietario |
| Actividad real de la clienta | 0 | el local parte del mismo respaldo fresco |
| Otros | 0 | sin ítems sin clasificar |
| **Total** | **96** | |

El endurecimiento posterior del dueño mínimo agrega una policy interna, por lo
que el snapshot final H5 contiene 97 diferencias informativas, 0 bloqueantes y
continúa con “otros” igual a cero.

## 6. Commits locales

Quedaron creados en la rama `sprint-1/universal-booking`, uno por H1–H5. No hubo
push, merge ni deploy. `backups/` y los adjuntos con datos quedan fuera de Git.

- H1 `065c573`
- H2 `aec5678`
- H3 `53a155a`
- H4 `52795e5`
- H5: commit propio en HEAD, incluido el permiso de columnas detectado antes de H6

## 7. H-12

Estado: **pendiente y bloqueante antes de la primera migración productiva**.

- 8 funciones difieren entre producción y el historial;
- 6 diferencias son cosméticas;
- 2 son lógicas: `get_professional_usage_counts()` y
  `delete_professional_if_unlinked(uuid,text)`;
- producción es la autoridad;
- ninguna reconciliación fue ejecutada.

Plan vigente, todavía no ejecutado: generar una migración propia con las ocho
definiciones y ACL exactas de producción, probar los dos comportamientos lógicos,
restaurar y verificar localmente, ejecutar regresión y solicitar autorización
explícita antes de producción.
