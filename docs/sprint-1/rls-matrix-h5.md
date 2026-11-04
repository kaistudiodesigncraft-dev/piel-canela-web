# Matriz RLS H5

Fecha de prueba: 2026-11-03. Entorno: Supabase local restaurado. Todas las
operaciones se ejecutaron dentro de una transacción con `ROLLBACK`.

Leyenda: `filtrado` permite leer únicamente filas activas, con precio positivo y
pertenecientes a un tratamiento activo con `config_enabled=true`; `todo` permite
al administrador leer también borradores; `denegado` significa error de permiso
o cero filas afectadas por RLS.

| Rol | Tabla | SELECT | INSERT | UPDATE | DELETE |
|---|---|---:|---:|---:|---:|
| `anon` | `treatment_options` | filtrado | denegado | denegado | denegado |
| `anon` | `treatment_option_combos` | filtrado | denegado | denegado | denegado |
| `anon` | `treatment_option_combo_items` | filtrado | denegado | denegado | denegado |
| `authenticated` sin admin | `treatment_options` | filtrado | denegado | denegado | denegado |
| `authenticated` sin admin | `treatment_option_combos` | filtrado | denegado | denegado | denegado |
| `authenticated` sin admin | `treatment_option_combo_items` | filtrado | denegado | denegado | denegado |
| `authenticated` + perfil admin activo | `treatment_options` | todo | permitido | permitido | permitido |
| `authenticated` + perfil admin activo | `treatment_option_combos` | todo | permitido | permitido | permitido |
| `authenticated` + perfil admin activo | `treatment_option_combo_items` | todo | permitido | permitido | permitido |

## Evidencia ejecutable

La prueba `supabase/tests/universal_booking_public_h5.sql` cubre las 36 celdas:

- intenta cada operación con `anon`;
- repite con `authenticated` sin perfil operativo;
- repite con un usuario autenticado cuyo rol `admin` existe en `profiles`;
- comprueba que opciones pausadas y tratamientos no activados no se filtren al público;
- comprueba dueño, atributos, `search_path` y ACL de la función H5;
- comprueba que `anon` posea `SELECT` únicamente sobre las columnas nuevas
  `booking_config` y `config_enabled` requeridas por el loader público;
- termina con `ok 1 - universal booking public H5 complete RLS matrix passed`.

Comando:

```powershell
.\node_modules\.bin\supabase.cmd test db supabase/tests/universal_booking_public_h5.sql
```

Resultado: `PASS`.

## Origen del rol administrativo

Las policies administrativas usan exactamente:

```sql
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()))
```

`public.is_admin(uuid)` no lee `app_metadata` ni `user_metadata`; consulta la
tabla de servidor `public.profiles`:

```sql
select exists (
  select 1
  from public.profiles
  where user_id = auth.uid()
    and is_active
    and role in ('admin', 'manager')
);
```

El rol `authenticated` tiene `SELECT`, pero no `INSERT`, `UPDATE` ni `DELETE`
sobre `profiles`. Por lo tanto, una persona no puede elevar su propio rol desde
el cliente aunque exista una policy histórica de actualización para propietarios.
