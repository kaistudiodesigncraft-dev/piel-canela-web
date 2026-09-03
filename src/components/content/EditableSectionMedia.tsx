import Image from "next/image";
import type { SiteContentField } from "@/domain/site-content";

export function editableSurfaceClassName(
  baseClassName: string,
  field?: SiteContentField,
) {
  if (!field || field.kind !== "image" || !field.settings.enabled || !field.value.trim()) {
    return baseClassName;
  }

  return [
    baseClassName,
    "editable-surface",
    "editable-surface--with-media",
    `editable-surface--${field.settings.surfacePreset}`,
    `editable-overlay--${field.settings.overlayPreset}`,
  ].join(" ");
}

export function EditableSectionMedia({
  field,
  priority = false,
  sizes = "100vw",
}: {
  field?: SiteContentField;
  priority?: boolean;
  sizes?: string;
}) {
  if (!field || field.kind !== "image" || !field.settings.enabled || !field.value.trim()) {
    return null;
  }

  return (
    <div className="editable-section-media" aria-hidden="true">
      <Image
        src={field.value}
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        style={{ objectPosition: `${field.settings.focalX}% ${field.settings.focalY}%` }}
      />
      <span className="editable-section-media__overlay" />
    </div>
  );
}
