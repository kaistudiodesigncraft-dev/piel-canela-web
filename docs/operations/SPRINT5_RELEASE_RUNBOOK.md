# Sprint 5 — liberación, rollback y recuperación

Este procedimiento protege la información operativa cargada por Piel Canela. Ningún paso autoriza un `db reset`, un seed, un `truncate` ni una limpieza masiva de Storage en el proyecto remoto.

## Alcance

- Proyecto Supabase: `dlrdlwjighvcyhirwgfu`.
- Producción: `https://piel-canela-web-mauve.vercel.app`.
- Orden de despliegue: respaldo, inventario, migraciones compatibles, aplicación desde un commit identificable, verificación y comparación.
- La eliminación permanente de tratamientos solo se permite mediante la RPC protegida, sin reservas ni especiales relacionados.

## Antes de desplegar

1. Confirmar que el commit a liberar existe en `origin/main` y registrar su SHA.
2. Exportar fuera de Git las tablas operativas: `treatments`, `professionals`, `specialties`, `availability_rules`, `availability_exceptions`, `monthly_specials`, `customers`, `bookings`, `profiles`, `site_content`, `site_content_drafts` y `site_content_revisions`.
3. Exportar el historial de migraciones y los manifiestos de `treatment-media`, `treatment-media-ingest`, `site-content-media` y `site-content-media-ingest`.
4. Ejecutar `supabase/audits/production_inventory.sql` y guardar conteos, IDs y fechas máximas en un respaldo privado.
5. Verificar que lint, typecheck, pruebas unitarias, E2E, build y auditoría de dependencias estén aprobados.
6. Confirmar que los secretos requeridos existen en producción sin copiar sus valores a logs ni documentación.

## Despliegue

1. Aplicar únicamente migraciones nuevas y aditivas con `supabase db push` desde el commit aprobado.
2. No ejecutar `supabase db reset` contra el proyecto remoto.
3. Comprobar las políticas RLS y las firmas de las RPC antes de publicar la aplicación.
4. Desplegar en Vercel desde el mismo SHA aprobado.
5. Mantener el aviso beta y `noindex` hasta la liberación final.

## Verificación posterior

1. Repetir el inventario y comparar conteos e IDs con la línea base.
2. Probar como `anon`: catálogo, detalle y entrada al turnero; no debe existir acceso de escritura.
3. Probar como `manager`: alta en borrador, carga de imagen, publicación, edición, contenido permitido y cierre de sesión.
4. Confirmar que `manager` no accede a `/admin/seguridad` ni a controles internos de Kai Studio.
5. Probar como `admin` una eliminación protegida solo con un tratamiento temporal sin relaciones.
6. Revisar errores por ID de incidente, sin buscar correos, teléfonos ni notas en logs.

## Criterio de rollback

Se revierte la aplicación si falla el acceso, el catálogo público, la creación/edición de tratamientos o el turnero. Las migraciones aditivas no se revierten automáticamente: primero se despliega el commit anterior y se conserva el esquema compatible.

Si una migración provoca pérdida o corrupción de datos:

1. detener escrituras desde la aplicación;
2. conservar evidencia e inventario del estado afectado;
3. restaurar desde el respaldo privado más reciente en un entorno aislado;
4. comparar IDs y relaciones antes de intervenir producción;
5. ejecutar una recuperación dirigida, nunca una reimportación total sin validación;
6. documentar el incidente y rotar secretos si pudieron quedar expuestos.

## Recuperación de medios

- Un reemplazo crea un objeto nuevo y cambia la referencia solo después de validarlo.
- El archivo anterior se conserva durante la ventana de rollback.
- No eliminar objetos por antigüedad sin comprobar tratamientos, especiales y revisiones de contenido.
- Ante un reemplazo fallido, mantener la referencia anterior y eliminar únicamente el ingreso temporal no asociado.

## Soporte

El usuario recibe un código de soporte. Los logs deben contener solamente ese ID, etapa, ruta lógica, método y nombre del error. No registrar contenido de formularios, notas, correos, teléfonos, tokens, URLs firmadas ni secretos.
