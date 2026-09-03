export const SITE_CONTENT_KEYS = [
  "hero_eyebrow",
  "hero_title",
  "hero_lead",
  "hero_image",
  "hero_image_caption",
  "categories_eyebrow",
  "categories_title",
  "categories_lead",
  "categories_background",
  "specials_eyebrow",
  "specials_title",
  "specials_lead",
  "specials_background",
  "approach_eyebrow",
  "approach_title",
  "approach_body_primary",
  "approach_body_secondary",
  "approach_background",
  "booking_eyebrow",
  "booking_title",
  "booking_step_1_title",
  "booking_step_1_text",
  "booking_step_2_title",
  "booking_step_2_text",
  "booking_step_3_title",
  "booking_step_3_text",
  "booking_step_4_title",
  "booking_step_4_text",
  "booking_background",
  "faq_eyebrow",
  "faq_title",
  "faq_1_question",
  "faq_1_answer",
  "faq_2_question",
  "faq_2_answer",
  "faq_3_question",
  "faq_3_answer",
  "faq_background",
  "catalog_header_eyebrow",
  "catalog_header_title",
  "catalog_header_lead",
  "catalog_header_image",
  "booking_header_eyebrow",
  "booking_header_title",
  "booking_header_lead",
  "booking_header_image",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];
export type SiteContentKind = "short_text" | "long_text" | "image";
export type SiteContentSection =
  | "hero"
  | "categories"
  | "specials"
  | "approach"
  | "booking"
  | "faq"
  | "catalog_header"
  | "booking_header";
export type SiteContentPresentation = "content" | "background";
export type SiteContentSurfacePreset = "plain" | "soft" | "contrast";
export type SiteContentOverlayPreset = "none" | "light" | "medium" | "strong";

export interface SiteAssetSettings {
  focalX: number;
  focalY: number;
  presentation: SiteContentPresentation;
  surfacePreset: SiteContentSurfacePreset;
  overlayPreset: SiteContentOverlayPreset;
  enabled: boolean;
}

export interface SiteContentField {
  key: SiteContentKey;
  section: SiteContentSection;
  label: string;
  kind: SiteContentKind;
  value: string;
  imagePath: string | null;
  imageAlt: string | null;
  displayOrder: number;
  updatedAt: string | null;
  settings: SiteAssetSettings;
}

const SITE_CONTENT_CHARACTER_LIMITS: Partial<Record<SiteContentKey, number>> = {
  hero_eyebrow: 72,
  hero_title: 96,
  hero_lead: 320,
  hero_image_caption: 160,
  categories_eyebrow: 72,
  categories_title: 72,
  categories_lead: 240,
  specials_eyebrow: 72,
  specials_title: 72,
  specials_lead: 240,
  approach_eyebrow: 72,
  approach_title: 96,
  approach_body_primary: 700,
  approach_body_secondary: 700,
  booking_eyebrow: 72,
  booking_title: 96,
  booking_step_1_title: 40,
  booking_step_1_text: 180,
  booking_step_2_title: 40,
  booking_step_2_text: 180,
  booking_step_3_title: 40,
  booking_step_3_text: 180,
  booking_step_4_title: 40,
  booking_step_4_text: 180,
  faq_eyebrow: 72,
  faq_title: 72,
  faq_1_question: 140,
  faq_1_answer: 500,
  faq_2_question: 140,
  faq_2_answer: 500,
  faq_3_question: 140,
  faq_3_answer: 500,
  catalog_header_eyebrow: 72,
  catalog_header_title: 96,
  catalog_header_lead: 320,
  booking_header_eyebrow: 72,
  booking_header_title: 96,
  booking_header_lead: 320,
};

export function getSiteContentCharacterLimit(field: Pick<SiteContentField, "key" | "kind">) {
  if (field.kind === "image") return 0;
  return SITE_CONTENT_CHARACTER_LIMITS[field.key] ?? (field.kind === "long_text" ? 900 : 180);
}

const contentSettings: SiteAssetSettings = {
  focalX: 50,
  focalY: 50,
  presentation: "content",
  surfacePreset: "plain",
  overlayPreset: "none",
  enabled: true,
};

const backgroundSettings: SiteAssetSettings = {
  ...contentSettings,
  presentation: "background",
  surfacePreset: "soft",
  overlayPreset: "light",
  enabled: false,
};

type SiteContentDefinition = Omit<SiteContentField, "updatedAt">;

function defineField(
  key: SiteContentKey,
  section: SiteContentSection,
  label: string,
  kind: SiteContentKind,
  value: string,
  displayOrder: number,
  options: { imageAlt?: string; settings?: SiteAssetSettings } = {},
): SiteContentDefinition {
  return {
    key,
    section,
    label,
    kind,
    value,
    imagePath: null,
    imageAlt: options.imageAlt ?? null,
    displayOrder,
    settings: options.settings ?? contentSettings,
  };
}

export const SITE_CONTENT_DEFINITIONS: readonly Omit<SiteContentField, "updatedAt">[] = [
  defineField("hero_eyebrow", "hero", "Texto superior", "short_text", "Bienestar, estética y recuperación", 1),
  defineField("hero_title", "hero", "Título principal", "short_text", "Cuidado profesional para cada momento.", 2),
  defineField("hero_lead", "hero", "Introducción", "long_text", "Conocé cada tratamiento, entendé qué podés esperar y elegí el momento que mejor se adapte a vos.", 3),
  defineField("hero_image", "hero", "Imagen principal", "image", "/images/treatment-massage-concept.png", 4, { imageAlt: "Fotografía conceptual de muestra de un tratamiento corporal" }),
  defineField("hero_image_caption", "hero", "Epígrafe de imagen", "short_text", "Un recorrido simple desde la elección hasta la pre-reserva.", 5),
  defineField("categories_eyebrow", "categories", "Texto superior", "short_text", "Encontrá tu recorrido", 1),
  defineField("categories_title", "categories", "Título", "short_text", "Nuestros tratamientos", 2),
  defineField("categories_lead", "categories", "Introducción", "long_text", "Elegí el camino que mejor se adapta a lo que necesitás hoy.", 3),
  defineField("categories_background", "categories", "Fondo de categorías", "image", "", 4, { imageAlt: "", settings: backgroundSettings }),
  defineField("specials_eyebrow", "specials", "Texto superior", "short_text", "Propuestas temporales", 1),
  defineField("specials_title", "specials", "Título", "short_text", "Especiales del mes", 2),
  defineField("specials_lead", "specials", "Introducción", "long_text", "Tratamientos seleccionados por Piel Canela con vigencia y valor promocional.", 3),
  defineField("specials_background", "specials", "Fondo de especiales", "image", "", 4, { imageAlt: "", settings: backgroundSettings }),
  defineField("approach_eyebrow", "approach", "Texto superior", "short_text", "Una elección informada", 1),
  defineField("approach_title", "approach", "Título", "short_text", "Cuidado cercano, información concreta.", 2),
  defineField("approach_body_primary", "approach", "Primer párrafo", "long_text", "Piel Canela reúne propuestas de bienestar, estética y recuperación dentro del entorno de Espacio O2. La web organiza esa variedad para que puedas entender cada opción antes de consultar.", 3),
  defineField("approach_body_secondary", "approach", "Segundo párrafo", "long_text", "Cuando un tratamiento necesita una evaluación previa, lo indicamos con claridad. La reserva queda pendiente hasta confirmar la seña por WhatsApp.", 4),
  defineField("approach_background", "approach", "Fondo de presentación", "image", "", 5, { imageAlt: "", settings: backgroundSettings }),
  defineField("booking_eyebrow", "booking", "Texto superior", "short_text", "Reservar es simple", 1),
  defineField("booking_title", "booking", "Título", "short_text", "Elegí con claridad y confirmá por WhatsApp.", 2),
  defineField("booking_step_1_title", "booking", "Paso 1", "short_text", "Elegí", 3),
  defineField("booking_step_1_text", "booking", "Descripción del paso 1", "long_text", "Explorá categorías y abrí el detalle completo.", 4),
  defineField("booking_step_2_title", "booking", "Paso 2", "short_text", "Seleccioná", 5),
  defineField("booking_step_2_text", "booking", "Descripción del paso 2", "long_text", "Indicá el tratamiento que querés reservar.", 6),
  defineField("booking_step_3_title", "booking", "Paso 3", "short_text", "Completá", 7),
  defineField("booking_step_3_text", "booking", "Descripción del paso 3", "long_text", "Elegí entre los días y horarios disponibles.", 8),
  defineField("booking_step_4_title", "booking", "Paso 4", "short_text", "Confirmá", 9),
  defineField("booking_step_4_text", "booking", "Descripción del paso 4", "long_text", "La seña y la confirmación final se coordinan por WhatsApp.", 10),
  defineField("booking_background", "booking", "Fondo de cómo reservar", "image", "", 11, { imageAlt: "", settings: backgroundSettings }),
  defineField("faq_eyebrow", "faq", "Texto superior", "short_text", "Antes de reservar", 1),
  defineField("faq_title", "faq", "Título", "short_text", "Preguntas frecuentes", 2),
  defineField("faq_1_question", "faq", "Pregunta 1", "short_text", "¿La pre-reserva confirma mi turno?", 3),
  defineField("faq_1_answer", "faq", "Respuesta 1", "long_text", "No. El horario se confirma cuando Piel Canela valida la seña por WhatsApp.", 4),
  defineField("faq_2_question", "faq", "Pregunta 2", "short_text", "¿Necesito crear una cuenta?", 5),
  defineField("faq_2_answer", "faq", "Respuesta 2", "long_text", "No. Solo se piden los datos mínimos para identificar y coordinar tu solicitud.", 6),
  defineField("faq_3_question", "faq", "Pregunta 3", "short_text", "¿Qué pasa si no sé qué tratamiento elegir?", 7),
  defineField("faq_3_answer", "faq", "Respuesta 3", "long_text", "Podés explorar por categoría y consultar cuando una evaluación previa sea necesaria.", 8),
  defineField("faq_background", "faq", "Fondo de preguntas frecuentes", "image", "", 9, { imageAlt: "", settings: backgroundSettings }),
  defineField("catalog_header_eyebrow", "catalog_header", "Texto superior", "short_text", "Catálogo Piel Canela", 1),
  defineField("catalog_header_title", "catalog_header", "Título", "short_text", "Encontrá el tratamiento adecuado.", 2),
  defineField("catalog_header_lead", "catalog_header", "Introducción", "long_text", "Filtrá por categoría y abrí cada ficha para conocer qué incluye, cuánto dura y qué considerar antes de reservar.", 3),
  defineField("catalog_header_image", "catalog_header", "Imagen de cabecera", "image", "", 4, { imageAlt: "", settings: { ...backgroundSettings, overlayPreset: "medium" } }),
  defineField("booking_header_eyebrow", "booking_header", "Texto superior", "short_text", "Reservá tu tratamiento", 1),
  defineField("booking_header_title", "booking_header", "Título", "short_text", "Elegí un día y horario disponible.", 2),
  defineField("booking_header_lead", "booking_header", "Introducción", "long_text", "Tu solicitud queda pendiente hasta que Piel Canela confirme la seña por WhatsApp.", 3),
  defineField("booking_header_image", "booking_header", "Imagen de cabecera", "image", "", 4, { imageAlt: "", settings: { ...backgroundSettings, overlayPreset: "medium" } }),
];

export function isSiteContentKey(value: string): value is SiteContentKey {
  return SITE_CONTENT_KEYS.includes(value as SiteContentKey);
}

export function getDefaultSiteContent(): SiteContentField[] {
  return SITE_CONTENT_DEFINITIONS.map((field) => ({ ...field, updatedAt: null }));
}

export function siteContentMap(fields: readonly SiteContentField[]) {
  return new Map(fields.map((field) => [field.key, field]));
}
