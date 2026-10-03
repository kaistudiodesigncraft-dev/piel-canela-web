import type { SVGProps } from "react";
import type { CategoryIconName } from "@/domain/treatment";

type BrandCategoryIconProps = SVGProps<SVGSVGElement> & {
  icon: CategoryIconName | string;
};

const sharedProps = {
  fill: "none",
  className: "brand-icon__line",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 2,
  vectorEffect: "non-scaling-stroke" as const,
};

function EsteticaIcon() {
  return <>
    <path {...sharedProps} d="M32 18c-6.5 5.8-8.7 15.6 0 24.6 8.7-9 6.5-18.8 0-24.6Z" />
    <path {...sharedProps} d="M28.6 41.7c-8.7.8-14.7-5.1-14.3-14.4 7.9-.6 13.5 3.1 15.7 9.8" />
    <path {...sharedProps} d="M35.4 41.7c8.7.8 14.7-5.1 14.3-14.4-7.9-.6-13.5 3.1-15.7 9.8" />
    <path {...sharedProps} d="M13.1 47.7c8.4 6.9 29.4 6.9 37.8 0-4.8-5.4-12.2-7.3-18.9-3.8-6.7-3.5-14.1-1.6-18.9 3.8Z" />
    <path className="brand-icon__accent" d="M21.2 14.2c4.6-.5 7.5 2.3 7.3 6.9-4.5.5-7.4-2.3-7.3-6.9Z" />
    <path className="brand-icon__accent" d="M42.8 14.2c-4.6-.5-7.5 2.3-7.3 6.9 4.5.5 7.4-2.3 7.3-6.9Z" />
  </>;
}

function BienestarIcon() {
  return <>
    <path {...sharedProps} d="M32.5 48.7c-10.7.8-18.9-5.9-19.8-17.1 10.8-.5 19.1 5.6 19.8 17.1Z" />
    <path {...sharedProps} d="M33.3 44.3c-.2-10.8 6-18.6 16.6-19.4.4 10.4-5.8 18.4-16.6 19.4Z" />
    <path {...sharedProps} d="M32.6 49.1c.2-7.9 6.9-13.4 16.6-13.8.2 9.1-6.1 14-16.6 13.8Z" />
    <path {...sharedProps} d="M20.5 36.2c4.2 1.6 8.3 5.1 12 10.8" />
    <path className="brand-icon__accent" d="M27.1 18.4c4.8-.4 7.8 2.5 7.7 7.2-4.7.5-7.7-2.4-7.7-7.2Z" />
    <path className="brand-icon__accent" d="M38.2 14.4c4.7-.4 7.6 2.4 7.5 7.1-4.6.5-7.6-2.3-7.5-7.1Z" />
  </>;
}

function RecuperacionIcon() {
  return <>
    <path {...sharedProps} d="M20 25.5h24M20 38.5h24" />
    <rect {...sharedProps} x="14" y="20" width="7" height="24" rx="3.5" />
    <rect {...sharedProps} x="7.5" y="24" width="6.5" height="16" rx="3.25" />
    <rect {...sharedProps} x="43" y="20" width="7" height="24" rx="3.5" />
    <rect {...sharedProps} x="50" y="24" width="6.5" height="16" rx="3.25" />
    <path className="brand-icon__accent" d="M8 13.5c5.1-.4 8.5 2.7 8.4 7.8-5 .5-8.4-2.6-8.4-7.8Z" />
    <path className="brand-icon__accent" d="M56 13.5c-5.1-.4-8.5 2.7-8.4 7.8 5 .5 8.4-2.6 8.4-7.8Z" />
    <path className="brand-icon__accent" d="M8 50.5c5.1.4 8.5-2.7 8.4-7.8-5-.5-8.4 2.6-8.4 7.8Z" />
    <path className="brand-icon__accent" d="M56 50.5c-5.1.4-8.5-2.7-8.4-7.8 5-.5 8.4 2.6 8.4 7.8Z" />
  </>;
}

export function BrandCategoryIcon({ icon, ...props }: BrandCategoryIconProps) {
  const variant = icon === "FlowerLotus"
    ? "bienestar"
    : icon === "PersonArmsSpread"
      ? "recuperacion"
      : "estetica";
  const drawing = variant === "bienestar"
    ? <BienestarIcon />
    : variant === "recuperacion"
      ? <RecuperacionIcon />
      : <EsteticaIcon />;

  return (
    <svg data-brand-icon={variant} viewBox="0 0 64 64" focusable="false" {...props}>
      <circle className="brand-icon__field" cx="32" cy="32" r="31" />
      {drawing}
    </svg>
  );
}
