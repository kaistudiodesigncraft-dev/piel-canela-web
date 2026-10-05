# Reparación administrativa: estado y liberación

## Implementado localmente

- RPC `save_admin_professional` transaccional: rol operativo, validación, bloqueo por ID, control de versión, especialidades vinculadas e impacto de desactivación.
- Formulario de profesional con guardado pendiente, feedback con foco, datos conservados ante error y advertencia de salida.
- Un fallo del conteo de vinculaciones ya no derriba Profesionales; la eliminación queda bloqueada.
- Imagen fallida descartada sin invalidar publicación, conservando path y preview del último archivo aceptado.
- Preservación de campos ante reset automático del formulario.
- Selector de modalidad con ancho completo y profesionales seleccionados inactivos que se pueden desmarcar explícitamente.
- Regresiones SQL locales de atomicidad, versión obsoleta y acceso anónimo; tests de componentes.

## No declarar cerrados todavía

1. **Sprint integridad:** falta conciliar los IDs productivos duplicados. La RPC existente requiere respaldo verificado; rechaza cruces de reservas y horarios profesionales personalizados. No ejecutar por coincidencia de nombre ni borrar perfiles originales.
2. **Sprint carga resistente:** implementación local disponible; falta smoke de navegador con manager en preview y fallas reales de red/Storage.
3. **Sprint depilación:** ajuste de layout realizado; falta probar un combo sintético completo en entorno aislado y validar el caso comercial con datos del cliente. No inventar precios en producción.
4. **Sprint liberación:** pendiente paridad de migraciones, responsive/teclado, restauración/eliminación y concurrencia E2E.

## Verificación de esta ejecución

- Next.js y `eslint-config-next` actualizados de `16.3.6` a `16.3.8` por el aviso de seguridad oficial del 30 de septiembre de 2026.
- 56 archivos y 170 tests unitarios/de componente aprobados después de la actualización.
- 14 recorridos E2E aprobados en serie en Chrome desktop y mobile; 2 pruebas remotas omitidas por no haberse indicado un preview en esa corrida. La corrida paralela saturó el servidor de desarrollo y no se usa como evidencia.
- La suite E2E fija consentimiento esencial antes de recorridos que no prueban el banner; evita que el overlay de preferencias invalide interacciones ajenas.
- ESLint global, TypeScript y build de producción con Supabase aprobaron después de todos los cambios.
- `pnpm audit --prod`: sin vulnerabilidades conocidas.
- SQL de atomicidad, versión obsoleta y permisos anónimos aprobado con rollback en Docker local.
- El nuevo test de formulario detectó el reset de React; se corrigió preservando los valores enviados antes del reset.
- Ninguna modificación de datos de producción, push ni deploy.

## Puertas de lanzamiento aún abiertas

- Producción no tiene `NEXT_PUBLIC_RELEASE_STAGE=live`: mientras falte, `robots.txt` bloquea todo el sitio y la metadata pública conserva `noindex`.
- La configuración pública productiva no tiene WhatsApp, correo, dirección, horario ni textos operativos/privacidad completos. No inventar esos valores; deben guardarse y verificarse desde Configuración.
- Agustina Spertino y Melina Albornoz siguen duplicadas por ID en producción. La exclusión de agenda es por UUID, por lo que no se debe lanzar el turnero como definitivo hasta ejecutar el preflight, confirmar que no haya conflictos, obtener un backup remoto completo y conciliar cada par con IDs explícitos.
- El inventario disponible en `C:/Users/Usuario/PielCanela-Backups/2026-10-03/public-inventory.json` es público y sanitizado; no reemplaza un backup administrativo de reservas, relaciones y Storage.
- La migración `20261003000100_atomic_professional_editor.sql` está aplicada y probada en Docker local; su presencia remota todavía no fue verificada mediante una conexión administrativa de solo lectura.

## Orden obligatorio de liberación

1. Guardar inventario y backup de producción fuera del repositorio, incluyendo relaciones y reservas. Comparar IDs y conteos; ninguna renumeración/conversión prevista.
2. Aplicar `supabase/migrations/20261003000100_atomic_professional_editor.sql` primero. Fue aplicada y probada solo en Docker local. No migra datos existentes.
3. Desplegar código a preview; nunca publicar el código nuevo antes de que exista la RPC en su base.
4. Manager: crear perfil sintético, editar, simular error, comprobar que conserva datos; retirar especialidad usada debe rechazar; desactivar requiere confirmación; dos editores deben detectar conflicto.
5. Tratamiento: imagen inválida y fallo de reemplazo deben permitir guardar sin cambiar la imagen anterior; validar modalidad a 320/390/768/1024/1440 px.
6. Revisar conciliación real con matriz source/target explícita y conflictos antes de ejecutar `reconcile_professional_identity`. Guardar el backup fuera de Git. No modificar reservas para eliminar conflictos artificialmente.
7. Solo después de las puertas anteriores: aprobación y despliegue productivo, comparar inventario.

## Rollback

La migración agrega una RPC compatible con el código anterior. Un rollback del código no necesita borrar funciones ni restaurar tablas. No ejecutar reset/seed. Si hubo guardados reales, conservarlos y reparar por evento: nunca reimportar un backup completo para revertir una interfaz.

Las capturas de `tmp/` contienen información administrativa: no agregarlas al commit. Este trabajo no realizó push ni despliegue ni cambios de contenido productivo.

## Preview solicitado posteriormente

- Desplegado exclusivamente a preview: https://piel-canela-kjjmhmxn9-kai-dev1.vercel.app
- Deployment: `dpl_Akb26AcoLbMe1T2zPTJNZe74Nza6`, estado READY.
- Aviso visible de beta retirado; indexación conservada bloqueada durante validación.
- Inventario público parcial fuera del repositorio: `C:/Users/Usuario/PielCanela-Backups/2026-10-03/public-inventory.json`.
- No existe todavía backup completo verificado: falta conexión administrativa remota para exportar DB y acceso a Storage privado. No fusionar hasta obtenerlo.
- El operador informó que aplicó la migración; no se comprobó aún la función remota mediante acceso administrativo.
- Preview tiene configuración incompleta para operaciones protegidas: verificar BOOKING_GUARD_SECRET y TREATMENT_DELETE_CODE_HASH, cuya configuración visible no incluye este preview genérico.
- Ninguna copia de datos Docker a producción, fusión o promoción productiva realizada.
