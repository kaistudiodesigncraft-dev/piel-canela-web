# Plan de salida a producción — plantilla universal

Este documento no autoriza ni ejecuta cambios.

## Ventana recomendada

Ventana de 90 minutos con baja actividad, una persona de la agencia disponible
para validar panel y catálogo y sin carga simultánea de tratamientos.

## Orden y tiempos estimados

1. Respaldo fresco, verificado y segunda copia cifrada confirmada — 20 min.
2. Reconciliar H-12 tomando producción como verdad; probar local y verificar
   hashes — 20 min.
3. Aplicar migraciones aditivas H2–H5 en orden — 10 min.
4. Ejecutar verificador: solo objetos agregados, cero modificados/eliminados —
   5 min.
5. Desplegar el código verificado — 10 min.
6. Smoke público/admin, Depilación y una reserva simple sin crear datos reales —
   15 min.
7. Crear y activar un tratamiento QA **no publicado**, probarlo y volver a
   desactivar su configuración — 10 min.

## Criterios de aborto

- diferencia modificada o eliminada en el verificador;
- cambio en IDs, slugs, precios, duraciones o relaciones de Depilación;
- una policy o función existente difiere de la definición reconciliada;
- una migración requiere reescribir datos;
- smoke legacy o RLS falla;
- el tratamiento QA aparece en el catálogo público.

## Rollback

- Antes del deploy: ejecutar los rollback H5 → H4 → H3 → H2; 10–15 min.
- Después del deploy sin reservas v2: volver al deployment anterior y ejecutar
  los rollback en orden inverso; 15–20 min.
- Si existe una reserva v2: no eliminar ni reescribirla. Apagar
  `config_enabled`, volver al deployment anterior y conservar las tablas
  aditivas hasta una revisión; 10 min para contener, análisis posterior.
- H-12: restaurar las definiciones exactas exportadas del catálogo productivo;
  10 min.

En todos los casos se corre el verificador y el smoke de Depilación después del
rollback. No se usan `DROP`, `TRUNCATE` ni eliminación masiva de datos reales.

