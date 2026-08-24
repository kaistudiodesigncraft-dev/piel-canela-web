export const TREATMENT_CATEGORY_SLUGS = [
  "estetica",
  "bienestar",
  "recuperacion",
] as const;

export type TreatmentCategorySlug = (typeof TREATMENT_CATEGORY_SLUGS)[number];

export type CategoryIconName =
  | "UserFocus"
  | "FlowerLotus"
  | "PersonArmsSpread";

export interface TreatmentCategory {
  id: string;
  name: string;
  slug: TreatmentCategorySlug;
  shortDescription: string;
  icon: CategoryIconName;
  displayOrder: number;
  isActive: boolean;
}

export interface Specialty {
  id: string;
  name: string;
  slug: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
}

export interface TreatmentImage {
  src: string;
  alt: string;
  focalPoint: `${number}% ${number}%`;
  width: number;
  height: number;
}

export interface Treatment {
  id: string;
  categoryId: string;
  specialtyId: string;
  professionalId: string | null;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  expectations: readonly string[];
  characteristics: readonly string[];
  durationMinutes: number;
  bufferMinutes: number;
  startIntervalMinutes: 15 | 30 | 60;
  priceCents: number;
  preparation: string | null;
  contraindications: string | null;
  professional: string | null;
  image: TreatmentImage;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySpecial {
  id: string;
  treatmentId: string;
  title: string;
  shortDescription: string;
  detail: string;
  specialPriceCents: number;
  referencePriceCents: number | null;
  startsAt: string;
  endsAt: string;
  image: TreatmentImage;
  isActive: boolean;
  terms: string | null;
  createdBy: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingInitialSelection {
  treatmentId: string;
  monthlySpecialId?: string;
}

export interface ResolvedBookingSelection extends BookingInitialSelection {
  treatmentName: string;
  monthlySpecialTitle?: string;
  durationMinutes: number;
  basePriceCents: number;
  appliedPriceCents: number;
}

export const BOOKING_STATUSES = [
  "pending",
  "awaiting_deposit",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface DemoBooking {
  id: string;
  code: string;
  treatmentId: string;
  monthlySpecialId?: string;
  customerName: string;
  phone: string;
  email?: string;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
  status: BookingStatus;
  customerNotes?: string;
  internalNotes?: string;
  createdAt: string;
  isNew?: boolean;
}

export interface DemoBookingQuery {
  demoCode?: string;
  demoName?: string;
  demoPhone?: string;
  demoEmail?: string;
  demoDate?: string;
  demoTime?: string;
  demoTreatmentId?: string;
  demoMonthlySpecialId?: string;
  demoNotes?: string;
}

export function isTreatmentCategorySlug(
  value: string | null | undefined,
): value is TreatmentCategorySlug {
  return TREATMENT_CATEGORY_SLUGS.includes(value as TreatmentCategorySlug);
}
