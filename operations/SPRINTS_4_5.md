# Sprints 4 y 5 · integración local

Actualizado: 2026-09-11. No desplegado. No se modificaron datos productivos en esta pasada.

## Implementado

- Configuración ampliada para horarios de recepción, responsable/contacto de privacidad y condiciones de ausencias y paquetes. La agencia cargará estos datos; no se inventan valores.
- Migración aditiva 20260910001700; consultas secundarias compatibles con el esquema anterior. Campos ausentes en un formulario no borran valores guardados.
- Footer con contactos validados, año dinámico y enlace a especiales solo cuando existen propuestas vigentes.
- Páginas de privacidad, condiciones y 404.
- Portada con misma fuente de contenido, imagen, descripción accesible, encuadre y estado habilitado. Composición renovada sin cambiar tipografías ni paleta.
- Parallax de 20 px exclusivamente sobre imagen en escritorio; limpieza al desmontar y al cambiar preferencia de movimiento. No oculta contenido ni interviene el turnero.

## Verificación local

- Typecheck y lint aprobados.
- Build de producción con fixtures aprobado.
- Pruebas unitarias de portada y configuración: 9 aprobadas.
- Nuevas pruebas E2E: 2 aprobadas en Chrome; cinco anchos (320–1440), reducción de movimiento, navegación legal y respuesta 404. Avisos de desarrollo de React por CSP sin unsafe-eval; no se relajó la política de seguridad.

## Pendientes antes de liberación

### Información recibida el 2026-09-12

- El usuario informa que las migraciones fueron implementadas. Pendiente verificar versiones aplicadas y pruebas funcionales/RLS; no volver a ejecutarlas a ciegas.
- WhatsApp público confirmado: 3517677404. Formato internacional previsto para móvil argentino: +54 9 351 767-7404 (`5493517677404` para enlaces).
- Correo público confirmado: espaciopielcanela@gmail.com.
- Estos datos quedan documentados; su guardado en `business_settings` de producción no fue ejecutado ni verificado en esta actualización. Deben cargarse desde Configuración, conservando los demás valores.
- El correo público no configura SMTP ni cambia credenciales de acceso. El número público no habilita por sí solo WhatsApp automático de Meta.

1. Backup actualizado e inventario comparativo de datos y Storage del cliente.
2. Validar y aplicar en entorno aislado las migraciones 20260909001500, 20260909001600 y 20260910001700; comprobar RLS con manager/admin/anon. No aplicar resets ni seeds productivos.
3. Smoke autenticado: tratamientos, fotos, combos, agenda, cambios de configuración y paquetes, sin usar datos reales como fixtures.
4. Agencia: completar y aprobar contactos, responsable de privacidad y políticas. Revisión legal de conservación y transferencias de datos pendiente; la página no certifica cumplimiento.
5. SMTP, URLs autorizadas y prueba de recuperación con cuenta de ensayo.
6. WhatsApp automático continúa desactivado: faltan número/proveedor Meta, plantillas aprobadas, consentimiento y prueba controlada. El enlace manual es independiente.
7. Pulido visual de humo/hojas y transiciones entre secciones aún no implementado; no reemplazar las fotos del cliente con decoración de muestra.
8. Regresión completa, auditoría de dependencias, revisión visual humana, commit identificable, preview y aprobación antes de producción.

La compilación y las pruebas con fixtures no certifican el backend productivo ni autorizan anunciar disponibilidad total.
