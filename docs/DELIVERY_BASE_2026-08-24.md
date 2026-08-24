# Base operativa para carga de contenido

## Alcance de esta entrega

La agencia puede trabajar con contenido real desde el panel autenticado:

- crear tratamientos como borrador;
- editar nombre, redacción comercial y datos operativos;
- asignar categoría, especialidad y profesional;
- cargar y reemplazar fotografías con texto alternativo y punto focal;
- previsualizar, publicar, desactivar y reactivar;
- comprobar el tratamiento publicado en el catálogo público;
- eliminar cargas equivocadas sin historial mediante una confirmación secundaria.

El acceso del cliente final mediante QR se mantiene postergado. Esta postergación no bloquea el trabajo de la agencia con su cuenta de Kai Studio.

## Persistencia y continuidad

Los tratamientos, textos y referencias de imágenes se guardan en PostgreSQL y Supabase Storage. Un despliegue de código en Vercel no reinicia ni reemplaza esos datos.

Para conservar esta garantía:

- no usar `supabase db reset` contra producción;
- no reemplazar datos reales mediante seeds;
- respaldar base y Storage antes de una migración destructiva;
- aplicar cambios de esquema mediante migraciones versionadas;
- mantener los fixtures identificados como muestra hasta que sean reemplazados por contenido aprobado.

## Regla de eliminación

La eliminación permanente es excepcional y requiere:

1. una sesión administrativa válida;
2. el código secundario configurado únicamente como hash en el servidor;
3. la confirmación explícita del tratamiento;
4. ausencia total de reservas y especiales relacionados.

Si existe historial, la base de datos impide la eliminación. El tratamiento debe desactivarse para retirarlo de la web sin perder trazabilidad.

## Trabajo posterior no bloqueante

- refinamiento estético responsive;
- assets finales y material fotográfico aprobado;
- logos definitivos;
- motion y microinteracciones;
- activación final de cuentas mediante QR;
- regresión visual completa después de incorporar el contenido real.

Estos puntos no cambian el contrato de datos ni deben borrar el contenido cargado desde esta entrega.
