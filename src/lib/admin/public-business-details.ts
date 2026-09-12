import { z } from "zod";

export const PUBLIC_BUSINESS_DETAILS_COLUMNS = "reception_hours,privacy_responsible,privacy_contact_email,no_show_policy,package_policy";

export interface PublicBusinessDetails {
  reception_hours: string | null;
  privacy_responsible: string | null;
  privacy_contact_email: string | null;
  no_show_policy: string | null;
  package_policy: string | null;
}

const plainText = (max: number) => z.string().trim().max(max).refine(
  (value) => !/[<>]/.test(value), "Escribí texto sin etiquetas HTML.",
);
const schema = z.object({
  receptionHours: plainText(500),
  privacyResponsible: plainText(200),
  privacyContactEmail: z.union([z.literal(""), z.string().trim().email().max(180)]),
  noShowPolicy: plainText(2000),
  packagePolicy: plainText(2000),
});

export function parsePublicBusinessDetails(formData: FormData) {
  return schema.safeParse(Object.fromEntries(
    Object.keys(schema.shape).map((name) => [name, formData.get(name) ?? ""]),
  ));
}

// Omitted controls from an older/disabled editor never erase saved values.
export function publicBusinessDetailsPatch(formData: FormData, values: z.infer<typeof schema>) {
  const mapping = {
    receptionHours: "reception_hours", privacyResponsible: "privacy_responsible",
    privacyContactEmail: "privacy_contact_email", noShowPolicy: "no_show_policy", packagePolicy: "package_policy",
  } as const;
  return Object.fromEntries(Object.entries(mapping)
    .filter(([field]) => formData.has(field))
    .map(([field, column]) => [column, values[field as keyof typeof mapping] || null]));
}
