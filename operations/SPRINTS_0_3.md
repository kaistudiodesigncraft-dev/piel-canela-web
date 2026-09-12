# Operación, acceso y comunicación: checkpoint

Fecha: 2026-09-10. Base: `856f931`. Cambios locales, todavía sin commit ni despliegue.

## Preservación

No se ejecutaron escrituras en Supabase, cambios de cuentas, envíos reales, seeds, resets ni eliminación de Storage durante esta implementación. Esto no equivale a un inventario remoto actualizado ni a un respaldo verificado. Los archivos de `sources/` no se modificaron.

Antes de aplicar las migraciones nuevas: obtener respaldo recuperable de tablas operativas e historial de migraciones, manifiesto de Storage, inventario con IDs y hashes. Comparar después contemplando cargas legítimas simultáneas del cliente. No usar la coincidencia de conteos como única prueba.

## Implementación local

- Sprint 0: recuperación desde login, cambio por correo desde Mi cuenta, callback de un solo uso compatible con Strict Mode, errores y pendientes; recuperación del turnero ante red interrumpida con idempotencia conservada; aislamiento de consultas secundarias administrativas.
- Sprint 1: navegación lateral plegable y diálogo móvil, módulos por `module=today|agenda|availability|specials`, búsqueda paginada de servidor por nombre/teléfono/código, campos de paquete condicionales, aviso de zonas compartidas y guardado previo del modo combo. Las rutas existentes se conservan.
- Sprint 2: editor de mensajes por tratamiento, variables permitidas, previsualización, respaldo y resolución común en reserva/recepción. Se mantiene separada la plantilla libre manual de las plantillas aprobadas por Meta.
- Sprint 3: consentimiento opcional, wrapper transaccional de reserva, outbox, worker protegido, recepción firmada de estados con reconciliación, historial y reintento limitado. La función permanece desactivada por defecto. Sin consentimiento, no se encola el envío.

## Dependencias de publicación

1. Migración aditiva `20260909001500_whatsapp_communication.sql`: plantillas, consentimiento, outbox, entrega e interfaces operativas. Probar RLS y transacciones en Supabase aislado antes de aplicar a producción.
2. Migración aditiva `20260909001600_admin_booking_search.sql`: búsqueda con rol operativo y paginación. Si no está aplicada, la búsqueda informa error; las consultas sin búsqueda conservan el recorrido previo.
3. Desplegar código desde commit identificable después de base compatible y preview aprobado. Mantener `WHATSAPP_AUTOMATION_ENABLED=false`.
4. Verificar SMTP, destinos autorizados `/auth/complete?flow=recovery`, plantilla de correo y entrega real con dirección QA autorizada. Nunca cambiar la contraseña del cliente para probar.
5. Acordar cuenta/número Meta, plantillas aprobadas, condiciones del canal y consentimiento. Configurar secretos exclusivamente servidor según `src/lib/whatsapp/README.md`.
6. Acordar anticipación de recordatorios: no se programan todavía. No activar scheduler ni realizar envíos de QA a clientes sin autorización.

## Verificación

- TypeScript y ESLint aprobados durante integración.
- Build Next.js aprobado en modo fixtures. No certifica conectividad productiva.
- Playwright desktop: catálogo/filtro/detalle/foco, entrada al turnero, chequeo automatizado de accesibilidad pública y protección de catálogo/mensajes/cuenta aprobados. Recuperación a 320 px aprobada tras ajustar el test al modo fixtures, que no ofrece envío de correo.
- Playwright móvil: los cinco escenarios anteriores aprobados (15,4 s). Estas pruebas no incluyen operaciones de escritura con una cuenta autenticada real.
- Regresión Vitest completa: 46 archivos y 133 pruebas aprobadas (263,95 s).
- Pendientes: RLS/SQL real, paquete completo en entorno aislado, revisión visual del panel autenticado en todos los anchos, correo QA y WhatsApp real.
- La comprobación de Docker con permisos ampliados fue rechazada por el mecanismo de aprobación del entorno; no se buscó un camino alternativo para saltar ese bloqueo. Se necesita autorización disponible para reanudar las pruebas aisladas.

## Rollback

Ante un incidente, mantener automatización desactivada y revertir únicamente el código al commit anterior verificado. No eliminar las nuevas tablas: conservan eventos y evidencia. No borrar tratamientos, profesionales, reservas ni imágenes del cliente. Un envío incierto no se reintenta sin conciliación con el proveedor.

Los sprints 4 (datos públicos y condiciones) y 5 (hero y motion público) no se adelantaron. Estos sprints 0–3 no se consideran liberados mientras existan puertas de validación pendientes.
