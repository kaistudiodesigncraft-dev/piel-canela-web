const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatPrice(priceCents: number): string {
  return currencyFormatter.format(priceCents / 100).replace("ARS", "$ ");
}

export function formatDuration(durationMinutes: number): string {
  return `${durationMinutes} minutos`;
}

