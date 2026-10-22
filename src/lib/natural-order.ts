const spanishNaturalCollator = new Intl.Collator("es-AR", {
  ignorePunctuation: true,
  numeric: true,
  sensitivity: "base",
});

export function compareNaturalNames(left: string, right: string): number {
  return spanishNaturalCollator.compare(left.trim(), right.trim());
}

export function sortByNaturalName<T extends { id: string; name: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    compareNaturalNames(left.name, right.name) || left.id.localeCompare(right.id),
  );
}
