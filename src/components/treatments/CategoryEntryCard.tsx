"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BrandCategoryIcon } from "@/components/icons/BrandCategoryIcon";
import type { TreatmentCategory } from "@/domain/treatment";
import { buildCatalogHref } from "@/lib/treatments";

interface CategoryEntryCardProps {
  category: TreatmentCategory;
}

export function CategoryEntryCard({ category }: CategoryEntryCardProps) {
  return (
    <article className={`category-entry category-entry--${category.slug}`}>
      <BrandCategoryIcon
        className="category-entry__icon"
        icon={category.icon}
        aria-hidden="true"
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
