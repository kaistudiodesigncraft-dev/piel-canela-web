export const CATALOG_GROUPS = ["default", "facial", "brows_lashes", "depilation"] as const;

export type CatalogGroup = (typeof CATALOG_GROUPS)[number];

export interface CatalogSortDescriptor {
  categoryOrder: number;
  catalogGroup: CatalogGroup;
  isCombo: boolean;
  displayOrder: number;
}

const groupPriority: Record<CatalogGroup, number> = {
  default: 10,
  facial: 10,
  brows_lashes: 20,
  depilation: 30,
};

/** Stable catalog ordering shared by public and administrative lists. */
export function sortCatalogItems<T>(
  items: readonly T[],
  describe: (item: T) => CatalogSortDescriptor,
): T[] {
  return items
    .map((item, sourceIndex) => ({ item, sourceIndex, descriptor: describe(item) }))
    .sort((a, b) => {
      const category = a.descriptor.categoryOrder - b.descriptor.categoryOrder;
      if (category) return category;
      const aGroup = a.descriptor.isCombo ? 40 : groupPriority[a.descriptor.catalogGroup];
      const bGroup = b.descriptor.isCombo ? 40 : groupPriority[b.descriptor.catalogGroup];
      const group = aGroup - bGroup;
      if (group) return group;
      const manual = a.descriptor.displayOrder - b.descriptor.displayOrder;
      return manual || a.sourceIndex - b.sourceIndex;
    })
    .map(({ item }) => item);
}
