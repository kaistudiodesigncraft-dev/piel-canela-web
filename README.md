# Piel Canela

Demo integral de la web pública, catálogo, reserva simulada y panel administrativo de Piel Canela.

## Recorrido de demostración

1. Abrir `/tratamientos` y elegir una ficha.
2. Activar `Iniciar reserva`.
3. Elegir fecha y horario, completar datos de muestra y crear la pre-reserva.
4. Abrir `Ver esta reserva en el panel` para verla destacada en `/admin`.
5. Desde el panel se pueden probar filtros y cambios de estado en memoria.

## Desarrollo

```bash
pnpm install
pnpm dev
```

## Verificación

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

El contenido actual está separado en fixtures y marcado como muestra. La demo no conecta Supabase, no autentica el panel, no persiste cambios y no calcula disponibilidad real. La reserva creada viaja al panel mediante parámetros de URL y desaparece al recargar sin ellos.
