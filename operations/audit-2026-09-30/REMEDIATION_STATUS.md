# Estado de remediación de la auditoría

Fecha de validación local: 2026-10-01.

Este documento complementa `AUDITORIA_GENERAL.md`; no reescribe el diagnóstico histórico ni certifica producción.

## Cerrado en código y base aislada

- Elegibilidad profesional multiespecialidad y asignaciones explícitas por tratamiento.
- Autoasignación, reprogramación y paquetes con ventanas semanales, excepciones, bloqueos y ocupación profesional.
- Guardado transaccional de tratamientos con control de versión y publicación atómica.
- Restauración de historial con detección de versiones posteriores.
- Decodificación real, orientación y normalización WebP de imágenes en servidor.
- Límite persistente de cinco intentos por hora para acciones destructivas protegidas.
- Turnos manuales con extras autorizados e idempotencia estable; sesiones de paquetes con idempotencia estable.
- Next.js actualizado a 16.3.6 y auditoría de dependencias sin vulnerabilidades conocidas.
- Documentación activa alineada con capacidad por profesional e historial operativo.

## Evidencia local

- Base reconstruida desde cero con todas las migraciones y seed.
- Regresión SQL transaccional: guardado, versión, autoasignación, reprogramación, paquetes, rate limit y restauración; finaliza con `ROLLBACK`.
- Linter de PostgreSQL: sin errores.
- TypeScript y ESLint: aprobados.
- Vitest: 53 archivos y 163 pruebas aprobadas.
- Build Next.js 16.3.6: aprobado.
- Auditoría de dependencias de producción: sin vulnerabilidades conocidas.

## Pendiente antes de certificar producción

- Respaldo restaurable e inventario remoto inmediatamente antes de migrar.
- Aplicar las migraciones nuevas en Supabase antes que el código compatible.
- E2E autenticado real con roles `manager` y `admin`, incluida recuperación de contraseña y permisos negativos.
- Smoke de Storage y formularios en preview Vercel con archivos reales admitidos y corruptos.
- Revisión visual humana final en 320, 390, 768, 1024 y 1440 px.
- Comparar inventario remoto después del despliegue y mantener rollback por commit.
