# Comunicación operativa

Estado: implementación previa a activación. No se enviaron mensajes reales. Mantener `WHATSAPP_AUTOMATION_ENABLED=false` hasta QA con un número autorizado. La migración es aditiva y requiere respaldo verificado e inventario antes/después.

## Configuración exclusivamente servidor

- `WHATSAPP_AUTOMATION_ENABLED`: `false` por defecto; únicamente `true` habilita worker.
- `SUPABASE_SERVICE_ROLE_KEY`: secreto de servidor; nunca NEXT_PUBLIC.
- `WHATSAPP_WORKER_SECRET`: aleatorio, mínimo 32 caracteres. Scheduler POST `/api/whatsapp/worker` con Authorization Bearer. No se instala scheduler automáticamente.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` (versión actualmente admitida de Meta verificada al activar).
- `WHATSAPP_APP_SECRET` para HMAC del webhook.
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`: aleatorio, mínimo 32 caracteres.
- `WHATSAPP_TEMPLATE_LANGUAGE`, `WHATSAPP_TEMPLATE_PRE_RESERVATION`, `WHATSAPP_TEMPLATE_CONFIRMATION`, `WHATSAPP_TEMPLATE_PREPARATION`: nombres de plantillas aprobadas, no texto libre.

Las plantillas de proveedor deben tener cuatro parámetros de cuerpo en este orden: nombre, tratamiento y combo contratado si existe, fecha/hora de Córdoba, código. Aprobar ejemplos de paquetes antes de habilitarlos. El editor guarda texto para envío manual; nunca modifica la plantilla de Meta. Nombre e idioma de plantilla usados se registran en cada evento; versionar el nombre en Meta al cambiar el contrato.

## Integración y preservación

`create_booking_with_communication` envuelve la RPC existente y guarda consentimiento explícito y evento en la misma transacción. No transforma tratamientos ni reservas previas. Sin consentimiento no hay evento. Confirmar genera otro evento idempotente. Cancelar, terminar o mover una reserva invalida pendientes; el worker revalida además justo antes del envío.

Una confirmación HTTP sin ID, timeout, error 5xx o worker interrumpido queda `uncertain`: no se reenvía automáticamente. Reintento manual RPC `retry_whatsapp_message` exige rol operativo, motivo y estado `failed`, máximo tres intentos. Un mensaje incierto exige conciliación de proveedor; no convertirlo manualmente a pending sin comprobar que no fue enviado. Un error al persistir respuesta tampoco autoriza repetir envío.

Estados de entrega son independientes de reserva. Webhook verifica HMAC sobre bytes originales, valida phone-number-id y evita retroceder delivered/read. Los logs no contienen texto, teléfonos ni secretos. Hay una ventana inevitable entre validación y petición externa; una cancelación simultánea no puede retirar un mensaje ya aceptado por Meta.

## Pendientes para habilitación

- Verificar migración en Supabase aislado, RLS manager/admin/anon y creación/confirmación transaccional, concurrencia y doble envío.
- QA de worker/webhook contra proveedor simulado y después número QA real aprobado.
- Obtener número, cuenta, plantillas aprobadas y condiciones comerciales. Comprobar entrega.
- Configurar scheduler autenticado solo tras autorización.
- Acordar anticipación de recordatorios: no se encolan recordatorios automáticamente todavía.
- El historial y reintento limitado están en Mensajes (30 eventos recientes). Integrar después acceso contextual desde cada reserva y paginación del historial completo.
- Acordar revocación de consentimiento y retención. La tabla permite revoked_at; no exponer mutación pública.

Referencias primarias consultadas: https://www.postman.com/meta/whatsapp-business-platform/folder/lczy75a/templates y https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/.

## Verificación local

`vitest run src/lib/whatsapp --maxWorkers=1 --minWorkers=1 --pool=forks`: 11 pruebas aprobadas (variables, fallback, teléfonos, firma, autorización, flag desactivada, configuración faltante y webhook). ESLint del módulo y TypeScript completos aprobados. Son pruebas con mocks; no certifican SQL/RLS ni entrega Meta.

La bandeja durable `whatsapp_delivery_events` conserva estado firmado aunque llegue antes de que el worker guarde el ID de proveedor. El trigger lo reconcilia al persistir el ID. No almacena el payload completo ni el texto. Revisar retención de esta bandeja antes de activación.
