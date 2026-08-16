export const SITE_CONTENT_KEYS = [
  "hero_eyebrow",
  "hero_title",
  "hero_lead",
  "hero_image",
  "hero_image_caption",
  "categories_eyebrow",
  "categories_title",
  "categories_lead",
  "approach_eyebrow",
  "approach_title",
  "approach_body_primary",
  "approach_body_secondary",
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
  "faq_eyebrow",
  "faq_title",
  "faq_1_question",
  "faq_1_answer",
  "faq_2_question",
  "faq_2_answer",
  "faq_3_question",
  "faq_3_answer",
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];
export type SiteContentKind = "short_text" | "long_text" | "image";
export type SiteContentSection = "hero" | "categories" | "approach" | "booking" | "faq";

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
}

export const SITE_CONTENT_DEFINITIONS: readonly Omit<SiteContentField, "updatedAt">[] = [
  { key: "hero_eyebrow", section: "hero", label: "Texto superior", kind: "short_text", value: "Bienestar, estética y recuperación", imagePath: null, imageAlt: null, displayOrder: 1 },
  { key: "hero_title", section: "hero", label: "Título principal", kind: "short_text", value: "Cuidado profesional para cada momento.", imagePath: null, imageAlt: null, displayOrder: 2 },
  { key: "hero_lead", section: "hero", label: "Introducción", kind: "long_text", value: "Conocé cada tratamiento, entendé qué podés esperar y elegí el momento que mejor se adapte a vos.", imagePath: null, imageAlt: null, displayOrder: 3 },
  { key: "hero_image", section: "hero", label: "Imagen principal", kind: "image", value: "/images/treatment-massage-concept.png", imagePath: null, imageAlt: "Fotografía conceptual de muestra de un tratamiento corporal", displayOrder: 4 },
  { key: "hero_image_caption", section: "hero", label: "Epígrafe de imagen", kind: "short_text", value: "Un recorrido simple desde la elección hasta la pre-reserva.", imagePath: null, imageAlt: null, displayOrder: 5 },
  { key: "categories_eyebrow", section: "categories", label: "Texto superior", kind: "short_text", value: "Encontrá tu recorrido", imagePath: null, imageAlt: null, displayOrder: 1 },
  { key: "categories_title", section: "categories", label: "Título", kind: "short_text", value: "Nuestros tratamientos", imagePath: null, imageAlt: null, displayOrder: 2 },
  { key: "categories_lead", section: "categories", label: "Introducción", kind: "long_text", value: "Elegí el camino que mejor se adapta a lo que necesitás hoy.", imagePath: null, imageAlt: null, displayOrder: 3 },
  { key: "approach_eyebrow", section: "approach", label: "Texto superior", kind: "short_text", value: "Una elección informada", imagePath: null, imageAlt: null, displayOrder: 1 },
  { key: "approach_title", section: "approach", label: "Título", kind: "short_text", value: "Cuidado cercano, información concreta.", imagePath: null, imageAlt: null, displayOrder: 2 },
  { key: "approach_body_primary", section: "approach", label: "Primer párrafo", kind: "long_text", value: "Piel Canela reúne propuestas de bienestar, estética y recuperación dentro del entorno de Espacio O2. La web organiza esa variedad para que puedas entender cada opción antes de consultar.", imagePath: null, imageAlt: null, displayOrder: 3 },
  { key: "approach_body_secondary", section: "approach", label: "Segundo párrafo", kind: "long_text", value: "Cuando un tratamiento necesita una evaluación previa, lo indicamos con claridad. La reserva queda pendiente hasta confirmar la seña por WhatsApp.", imagePath: null, imageAlt: null, displayOrder: 4 },
  { key: "booking_eyebrow", section: "booking", label: "Texto superior", kind: "short_text", value: "Reservar es simple", imagePath: null, imageAlt: null, displayOrder: 1 },
  { key: "booking_title", section: "booking", label: "Título", kind: "short_text", value: "Elegí con claridad y confirmá por WhatsApp.", imagePath: null, imageAlt: null, displayOrder: 2 },
  { key: "booking_step_1_title", section: "booking", label: "Paso 1", kind: "short_text", value: "Elegí", imagePath: null, imageAlt: null, displayOrder: 3 },
  { key: "booking_step_1_text", section: "booking", label: "Descripción del paso 1", kind: "long_text", value: "Explorá categorías y abrí el detalle completo.", imagePath: null, imageAlt: null, displayOrder: 4 },
  { key: "booking_step_2_title", section: "booking", label: "Paso 2", kind: "short_text", value: "Seleccioná", imagePath: null, imageAlt: null, displayOrder: 5 },
  { key: "booking_step_2_text", section: "booking", label: "Descripción del paso 2", kind: "long_text", value: "Indicá el tratamiento que querés reservar.", imagePath: null, imageAlt: null, displayOrder: 6 },
  { key: "booking_step_3_title", section: "booking", label: "Paso 3", kind: "short_text", value: "Completá", imagePath: null, imageAlt: null, displayOrder: 7 },
  { key: "booking_step_3_text", section: "booking", label: "Descripción del paso 3", kind: "long_text", value: "Elegí entre los días y horarios disponibles.", imagePath: null, imageAlt: null, displayOrder: 8 },
  { key: "booking_step_4_title", section: "booking", label: "Paso 4", kind: "short_text", value: "Confirmá", imagePath: null, imageAlt: null, displayOrder: 9 },
  { key: "booking_step_4_text", section: "booking", label: "Descripción del paso 4", kind: "long_text", value: "La seña y la confirmación final se coordinan por WhatsApp.", imagePath: null, imageAlt: null, displayOrder: 10 },
  { key: "faq_eyebrow", section: "faq", label: "Texto superior", kind: "short_text", value: "Antes de reservar", imagePath: null, imageAlt: null, displayOrder: 1 },
  { key: "faq_title", section: "faq", label: "Título", kind: "short_text", value: "Preguntas frecuentes", imagePath: null, imageAlt: null, displayOrder: 2 },
  { key: "faq_1_question", section: "faq", label: "Pregunta 1", kind: "short_text", value: "¿La pre-reserva confirma mi turno?", imagePath: null, imageAlt: null, displayOrder: 3 },
  { key: "faq_1_answer", section: "faq", label: "Respuesta 1", kind: "long_text", value: "No. El horario se confirma cuando Piel Canela valida la seña por WhatsApp.", imagePath: null, imageAlt: null, displayOrder: 4 },
  { key: "faq_2_question", section: "faq", label: "Pregunta 2", kind: "short_text", value: "¿Necesito crear una cuenta?", imagePath: null, imageAlt: null, displayOrder: 5 },
  { key: "faq_2_answer", section: "faq", label: "Respuesta 2", kind: "long_text", value: "No. Solo se piden los datos mínimos para identificar y coordinar tu solicitud.", imagePath: null, imageAlt: null, displayOrder: 6 },
  { key: "faq_3_question", section: "faq", label: "Pregunta 3", kind: "short_text", value: "¿Qué pasa si no sé qué tratamiento elegir?", imagePath: null, imageAlt: null, displayOrder: 7 },
  { key: "faq_3_answer", section: "faq", label: "Respuesta 3", kind: "long_text", value: "Podés explorar por categoría y consultar cuando una evaluación previa sea necesaria.", imagePath: null, imageAlt: null, displayOrder: 8 },
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
