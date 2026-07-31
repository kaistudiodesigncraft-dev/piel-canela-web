"use client";

import {
  FlowerLotus,
  PersonArmsSpread,
  UserFocus,
  type Icon,
} from "@phosphor-icons/react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { TreatmentCategory } from "@/domain/treatment";
import { buildCatalogHref } from "@/lib/treatments";

const icons: Record<TreatmentCategory["icon"], Icon> = {
  UserFocus,
  FlowerLotus,
  PersonArmsSpread,
};

interface CategoryEntryCardProps {
  category: TreatmentCategory;
}

export function CategoryEntryCard({ category }: CategoryEntryCardProps) {
  const CategoryIcon = icons[category.icon];

  return (
    <article className={`category-entry category-entry--${category.slug}`}>
      <CategoryIcon
        className="category-entry__icon"
        aria-hidden="true"
        weight="regular"
      />
      <div className="category-entry__body">
        <h3>{category.name}</h3>
        <p>{category.shortDescription}</p>
        <Link className="text-link" href={buildCatalogHref(category.slug)}>
          Ver tratamientos
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
