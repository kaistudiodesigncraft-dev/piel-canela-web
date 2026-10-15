import Image from "next/image";
import type { HTMLAttributes } from "react";
import type { CategoryIconName } from "@/domain/treatment";

type BrandCategoryIconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  icon: CategoryIconName | string;
};

const categoryIconAssets = {
  estetica: "/brand/icons/category-estetica.svg",
  bienestar: "/brand/icons/category-bienestar.svg",
  recuperacion: "/brand/icons/category-recuperacion.svg",
} as const;

type BrandCategoryVariant = keyof typeof categoryIconAssets;

function resolveCategoryVariant(icon: CategoryIconName | string): BrandCategoryVariant {
  if (icon === "FlowerLotus") return "bienestar";
  if (icon === "PersonArmsSpread") return "recuperacion";
  return "estetica";
}

/** Renders the exact category medallion supplied in Piel Canela's brand kit. */
export function BrandCategoryIcon({ icon, className, ...props }: BrandCategoryIconProps) {
  const variant = resolveCategoryVariant(icon);

  return (
    <span
      className={["brand-category-icon", className].filter(Boolean).join(" ")}
      data-brand-icon={variant}
      {...props}
    >
      <Image
        src={categoryIconAssets[variant]}
        alt=""
        width={200}
        height={200}
      />
    </span>
  );
}
