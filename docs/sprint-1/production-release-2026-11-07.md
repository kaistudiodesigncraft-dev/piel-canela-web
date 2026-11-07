# Liberación productiva — plantilla universal y paquetes

Fecha: 2026-11-07 (America/Buenos_Aires)

## Resultado

Los hitos H2–H10 y la reconciliación H-12 quedaron aplicados en producción de
forma aditiva. El código productivo corresponde al commit `7d10ec8` de la rama
`sprint-1/universal-booking`.

Dominios verificados:

- `https://piel-canela-catalogo.vercel.app`
- `https://piel-canela-web-mauve.vercel.app`
- `https://piel-canela-web-kai-dev1.vercel.app`

Deployment productivo de Vercel:

- ID: `dpl_CJDLDQYR2e1yEtSj4dBTkFQJwnYw`
- URL inmutable: `https://piel-canela-3fw3o0hqk-kai-dev1.vercel.app`
- Estado verificado: `Ready`

## Protección de datos y activación

- `config_enabled=true`: 0 tratamientos.
- Opciones universales: 0 filas.
- Combos universales: 0 filas.
- Relaciones universales: 0 filas.
- Contratos, sesiones y operaciones de paquetes universales: 0 filas.
- HIFU permanece inactivo, pertenece al grupo `default` y no fue publicado.
- Depilación permanece activa en el grupo explícito `depilation` y conserva su
  adaptador histórico.

La liberación no convirtió tratamientos ni creó reservas, clientes, opciones,
combos o paquetes. La clienta puede cargar un tratamiento nuevo desde el editor
universal y habilitarlo únicamente cuando su catálogo esté completo.

## Inventario posterior a la liberación

Consulta de solo lectura:

- tratamientos: 23;
- reservas: 19;
- clientes: 23;
- zonas de Depilación: 21;
- combos de Depilación: 14;
- relaciones combo-zona de Depilación: 47.

## Humo productivo

- Portada y detalle público de Depilación: HTTP 200.
- Depilación pública: zonas sueltas, combos de Mujeres y Hombres y Axilas
  visibles.
- Editor de HIFU: modalidades, opciones, propuestas, precio, condiciones y
  simulador disponibles.
- Editor universal de Depilación: bloqueado correctamente como “Circuito
  histórico protegido”.
- No se creó ninguna reserva ni fixture durante el humo.

## Calidad

- Vitest: 88 archivos y 295/295 pruebas aprobadas.
- TypeScript estricto: aprobado.
- ESLint: aprobado.
- Build productivo de Vercel: aprobado.
- Supabase Health Advisor: sin hallazgos.

El primer intento local de Vitest dentro del sandbox falló antes de importar
tests por permisos `EPERM` sobre su directorio temporal. La misma suite se
repitió fuera de ese aislamiento y aprobó 295/295; no fue un fallo del código.

## Respaldo

Respaldo lógico fresco de solo lectura:

- `backups/sprint-1/production-readonly-2026-11-06_203000`
- 33 tablas, 2.709 filas, 10 grupos de esquema y 2.121 objetos de esquema.
- Diferencias bloqueantes de contrato: 0.
- Referencias rotas detectadas: 0.

Segunda copia cifrada, fuera de Git:

- `C:\Users\Usuario\Documents\Piel-Canela-Backups\2026-11-06\piel-canela-production-2026-11-06.pcbak`
- SHA-256 cifrado: `229786646b2e18f83b34ad9c393d31b03074f2e90392c58f40ac50b0fa4deae9`
- SHA-256 del ZIP verificado por roundtrip:
  `c392da10af9d69d92f87060023297947c80ff959759619698f9a2bf03e7dfc2b`

La contraseña no se versiona ni se incluye en este documento.

## Seguimiento no bloqueante

1. Transferir la copia cifrada a la segunda computadora y conservar la
   contraseña por separado.
2. Integrar la rama del sprint a la rama principal sin reescritura de historia.
3. Configurar las credenciales de CI/CD en la cuenta definitiva; ninguna clave
   debe guardarse en Git.
4. Activar la protección de contraseñas filtradas de Supabase.
5. Revisar periódicamente los RPC `SECURITY DEFINER` públicos y mantener solo
   los permisos anónimos requeridos por reserva y disponibilidad.
6. Mantener HIFU inactivo hasta que la clienta termine su carga y la agencia
   valide el simulador.
