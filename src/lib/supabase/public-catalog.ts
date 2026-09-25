import { cache } from "react";
import {
  monthlySpecials as fixtureMonthlySpecials,
  treatmentCategories as fixtureCategories,
  treatments as fixtureTreatments,
} from "@/data/fixtures";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCombo,
  TreatmentCategory,
} from "@/domain/treatment";
import { createSupabasePublicServerClient } from "./public-server";
import { usesSupabaseDataSource } from "./env";

export interface PublicCatalogSnapshot {
  categories: readonly TreatmentCategory[];
  treatments: readonly Treatment[];
  monthlySpecials: readonly MonthlySpecial[];
  source: "fixtures" | "supabase";
}

const emptyBusinessDetails = {
  receptionHours: null as string | null,
  privacyResponsible: null as string | null,
  privacyContactEmail: null as string | null,
  noShowPolicy: null as string | null,
  packagePolicy: null as string | null,
};

export async function getPublicBookingSettings() {
  if (!usesSupabaseDataSource()) return {
    ...emptyBusinessDetails,
    whatsappNumber: null,
    address: null,
    publicEmail: null,
    instagramUrl: null,
    depositText: null,
    cancellationPolicy: null,
    maximumAdvanceDays: 13,
  };
  const supabase = createSupabasePublicServerClient();
  // Optional additive fields must not suppress existing contact data before migration.
  const details = await supabase.from("business_settings")
    .select("reception_hours,privacy_responsible,privacy_contact_email,no_show_policy,package_policy")
    .eq("singleton", true).maybeSingle();
  const businessDetails = details.error || !details.data ? emptyBusinessDetails : {
    receptionHours: details.data.reception_hours as string | null,
    privacyResponsible: details.data.privacy_responsible as string | null,
    privacyContactEmail: details.data.privacy_contact_email as string | null,
    noShowPolicy: details.data.no_show_policy as string | null,
    packagePolicy: details.data.package_policy as string | null,
  };
  const { data, error } = await supabase
    .from("business_settings")
    .select("whatsapp_number,address,public_email,instagram_url,deposit_text,cancellation_policy,maximum_advance_days")
    .eq("singleton", true)
    .maybeSingle();
  if (error) return { ...emptyBusinessDetails, whatsappNumber: null, address: null, publicEmail: null, instagramUrl: null, depositText: null, cancellationPolicy: null, maximumAdvanceDays: 13 };
  const row = data as {
    whatsapp_number: string | null;
    address: string | null;
    public_email: string | null;
    instagram_url: string | null;
    deposit_text: string | null;
    cancellation_policy: string | null;
    maximum_advance_days: number;
  } | null;
  return {
    ...businessDetails,
    whatsappNumber: row?.whatsapp_number ?? null,
    address: row?.address ?? null,
    publicEmail: row?.public_email ?? null,
    instagramUrl: row?.instagram_url ?? null,
    depositText: row?.deposit_text ?? null,
    cancellationPolicy: row?.cancellation_policy ?? null,
    maximumAdvanceDays: row?.maximum_advance_days ?? 13,
  };
}

interface CategoryRow {
  id: string;
  name: string;
  slug: "estetica" | "bienestar" | "recuperacion";
  short_description: string;
  icon_name: TreatmentCategory["icon"];
  display_order: number;
  is_active: boolean;
}

interface TreatmentRow {
  id: string;
  category_id: string;
  specialty_id: string;
  professional_id: string | null;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  expectations: string[];
  characteristics: string[];
  duration_minutes: number;
  buffer_minutes: number;
  start_interval_minutes: 15 | 30 | 60;
  selection_mode: "simple" | "closed_combo" | "combo_with_extras";
  requires_professional_assignment?: boolean;
  price_cents: number;
  preparation: string | null;
  contraindications: string | null;
  image_path: string | null;
  image_alt: string | null;
  image_focal_x: number | string;
  image_focal_y: number | string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  professional: { public_name: string | null; is_active: boolean }[] | null;
}

interface ComboRow {
  id: string;
  treatment_id: string;
  name: string;
  description: string;
  audience: "women" | "men" | "shared";
  mode: "single_session" | "package";
  session_count: number;
  pricing_mode?: "fixed_price" | "percentage_discount" | "tiered_discount";
  discount_percent?: number | string | null;
  tier_min_items?: number | null;
  tier_discount_percent?: number | string | null;
  allow_public_extras?: boolean;
  fixed_price_cents: number;
  validity_days: number | null;
  is_active: boolean;
  display_order: number;
  zones: {
    display_order: number;
    zone: {
      id: string;
      name: string;
      audience: "women" | "men" | "shared";
      reference_price_cents: number;
      duration_minutes: number;
      is_active: boolean;
      display_order: number;
    }[] | null;
  }[];
}

interface TreatmentProfessionalRow {
  treatment_id: string;
  professional_id: string;
  is_active: boolean;
}

interface ComboExtraRow {
  id: string;
  treatment_id: string;
  name: string;
  description: string;
  audience: "women" | "men" | "shared";
  price_cents: number;
  duration_minutes: number;
  is_active: boolean;
  display_order: number;
}

interface ComboAllowedExtraRow {
  combo_id: string;
  extra_id: string;
}

interface MonthlySpecialRow {
  id: string;
  treatment_id: string;
  title: string;
  short_description: string;
  detail: string;
  pricing_mode: "special_price" | "combo_catalog";
  special_price_cents: number;
  reference_price_cents: number | null;
  starts_at: string;
  ends_at: string;
  image_path: string;
  image_alt: string;
  image_focal_x: number | string;
  image_focal_y: number | string;
  terms: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface CatalogQueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
  status?: number;
  statusText?: string;
  success?: boolean;
}

function focalPoint(x: number | string, y: number | string) {
  return `${Math.round(Number(x) * 100)}% ${Math.round(Number(y) * 100)}%` as const;
}

function publicImageUrl(
  supabase: ReturnType<typeof createSupabasePublicServerClient>,
  bucket: string,
  path: string,
) {
  if (path.startsWith("/") || path.startsWith("https://")) return path;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function isPendingCatalogSchemaError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return ["42703", "42P01", "PGRST200", "PGRST204"].includes(error.code ?? "")
    || /does not exist|schema cache|relationship|Could not find/i.test(error.message ?? "");
}

export const getPublicCatalogSnapshot = cache(async function getPublicCatalogSnapshot(): Promise<PublicCatalogSnapshot> {
  if (!usesSupabaseDataSource()) {
    return {
      categories: fixtureCategories,
      treatments: fixtureTreatments,
      monthlySpecials: fixtureMonthlySpecials,
      source: "fixtures",
    };
  }

  const supabase = createSupabasePublicServerClient();
  let [categoriesResult, treatmentsResult, specialsResult, combosResult, treatmentProfessionalsResult, extrasResult, allowedExtrasResult] = await Promise.all([
    supabase
      .from("treatment_categories")
      .select("id,name,slug,short_description,icon_name,display_order,is_active")
      .order("display_order"),
    supabase
      .from("treatments")
      .select("id,category_id,specialty_id,professional_id,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,selection_mode,requires_professional_assignment,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order,created_at,updated_at,professional:professionals!treatments_professional_id_fkey(public_name,is_active)")
      .order("display_order"),
    supabase
      .from("monthly_specials")
      .select("id,treatment_id,title,short_description,detail,pricing_mode,special_price_cents,reference_price_cents,starts_at,ends_at,image_path,image_alt,image_focal_x,image_focal_y,terms,is_active,display_order,created_at,updated_at")
      .order("display_order"),
    supabase
      .from("treatment_combos")
      .select("id,treatment_id,name,description,audience,mode,session_count,pricing_mode,discount_percent,tier_min_items,tier_discount_percent,allow_public_extras,fixed_price_cents,validity_days,is_active,display_order,zones:treatment_combo_zones(display_order,zone:depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active,display_order))")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("treatment_professionals")
      .select("treatment_id,professional_id,is_active")
      .eq("is_active", true),
    supabase
      .from("treatment_combo_extras")
      .select("id,treatment_id,name,description,audience,price_cents,duration_minutes,is_active,display_order")
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("treatment_combo_allowed_extras")
      .select("combo_id,extra_id"),
  ]) as [
    CatalogQueryResult,
    CatalogQueryResult,
    CatalogQueryResult,
    CatalogQueryResult,
    CatalogQueryResult,
    CatalogQueryResult,
    CatalogQueryResult,
  ];

  let firstError = categoriesResult.error ?? treatmentsResult.error ?? specialsResult.error ?? combosResult.error ?? treatmentProfessionalsResult.error ?? extrasResult.error ?? allowedExtrasResult.error;
  if (isPendingCatalogSchemaError(firstError)) {
    [categoriesResult, treatmentsResult, specialsResult, combosResult] = await Promise.all([
      supabase
        .from("treatment_categories")
        .select("id,name,slug,short_description,icon_name,display_order,is_active")
        .order("display_order"),
      supabase
        .from("treatments")
        .select("id,category_id,specialty_id,professional_id,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,selection_mode,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order,created_at,updated_at,professional:professionals!treatments_professional_id_fkey(public_name,is_active)")
        .order("display_order"),
      supabase
        .from("monthly_specials")
        .select("id,treatment_id,title,short_description,detail,pricing_mode,special_price_cents,reference_price_cents,starts_at,ends_at,image_path,image_alt,image_focal_x,image_focal_y,terms,is_active,display_order,created_at,updated_at")
        .order("display_order"),
      supabase
        .from("treatment_combos")
        .select("id,treatment_id,name,description,audience,mode,session_count,fixed_price_cents,validity_days,is_active,display_order,zones:treatment_combo_zones(display_order,zone:depilation_zones(id,name,audience,reference_price_cents,duration_minutes,is_active,display_order))")
        .eq("is_active", true)
        .order("display_order"),
    ]) as [
      CatalogQueryResult,
      CatalogQueryResult,
      CatalogQueryResult,
      CatalogQueryResult,
    ];
    treatmentProfessionalsResult = { data: [], error: null, count: null, status: 200, statusText: "OK", success: true };
    extrasResult = { data: [], error: null, count: null, status: 200, statusText: "OK", success: true };
    allowedExtrasResult = { data: [], error: null, count: null, status: 200, statusText: "OK", success: true };
    firstError = categoriesResult.error ?? treatmentsResult.error ?? specialsResult.error ?? combosResult.error;
  }
  if (firstError) {
    throw new Error(`No se pudo cargar el catálogo público: ${firstError.message}`);
  }

  const categories = (categoriesResult.data as CategoryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortDescription: row.short_description,
    icon: row.icon_name,
    displayOrder: row.display_order,
    isActive: row.is_active,
  }));

  const professionalIdsByTreatment = new Map<string, string[]>();
  for (const row of (treatmentProfessionalsResult.data ?? []) as TreatmentProfessionalRow[]) {
    professionalIdsByTreatment.set(row.treatment_id, [...(professionalIdsByTreatment.get(row.treatment_id) ?? []), row.professional_id]);
  }

  const extrasById = new Map<string, ComboExtraRow>();
  for (const extra of (extrasResult.data ?? []) as ComboExtraRow[]) extrasById.set(extra.id, extra);
  const extraIdsByCombo = new Map<string, string[]>();
  for (const row of (allowedExtrasResult.data ?? []) as ComboAllowedExtraRow[]) {
    extraIdsByCombo.set(row.combo_id, [...(extraIdsByCombo.get(row.combo_id) ?? []), row.extra_id]);
  }

  const combosByTreatment = new Map<string, TreatmentCombo[]>();
  for (const row of (combosResult.data ?? []) as ComboRow[]) {
    const zones = row.zones
      .map((link) => Array.isArray(link.zone) ? link.zone[0] : link.zone)
      .filter((zone): zone is NonNullable<typeof zone> => Boolean(zone?.is_active))
      .map((zone) => ({
        id: zone.id,
        name: zone.name,
        audience: zone.audience,
        referencePriceCents: zone.reference_price_cents,
        durationMinutes: zone.duration_minutes,
        displayOrder: zone.display_order,
        isActive: zone.is_active,
      }));
    if (zones.length === 0) continue;
    const referencePriceCents = zones.reduce((total, zone) => total + zone.referencePriceCents, 0) * row.session_count;
    const extras = (extraIdsByCombo.get(row.id) ?? [])
      .map((id) => extrasById.get(id))
      .filter((extra): extra is ComboExtraRow => Boolean(extra))
      .map((extra) => ({
        id: extra.id,
        treatmentId: extra.treatment_id,
        name: extra.name,
        description: extra.description,
        audience: extra.audience,
        priceCents: extra.price_cents,
        durationMinutes: extra.duration_minutes,
        displayOrder: extra.display_order,
        isActive: extra.is_active,
      }));
    const combo: TreatmentCombo = {
      id: row.id,
      treatmentId: row.treatment_id,
      name: row.name,
      description: row.description,
      audience: row.audience,
      mode: row.mode,
      sessionCount: row.session_count,
      pricingMode: row.pricing_mode ?? "fixed_price",
      discountPercent: row.discount_percent == null ? null : Number(row.discount_percent),
      tierMinItems: row.tier_min_items ?? null,
      tierDiscountPercent: row.tier_discount_percent == null ? null : Number(row.tier_discount_percent),
      allowPublicExtras: Boolean(row.allow_public_extras),
      fixedPriceCents: row.fixed_price_cents,
      referencePriceCents,
      pricePerSessionCents: Math.round(row.fixed_price_cents / row.session_count),
      savingsCents: Math.max(0, referencePriceCents - row.fixed_price_cents),
      durationMinutes: zones.reduce((total, zone) => total + zone.durationMinutes, 0),
      validityDays: row.validity_days,
      zones,
      extras,
      displayOrder: row.display_order,
      isActive: row.is_active,
    };
    combosByTreatment.set(row.treatment_id, [...(combosByTreatment.get(row.treatment_id) ?? []), combo]);
  }

  const treatments = (treatmentsResult.data as TreatmentRow[]).map((row) => {
    const professional = Array.isArray(row.professional) ? row.professional[0] : null;
    return {
      id: row.id,
      categoryId: row.category_id,
      specialtyId: row.specialty_id,
      professionalId: row.professional_id,
      professionalIds: professionalIdsByTreatment.get(row.id) ?? (row.professional_id ? [row.professional_id] : []),
      requiresProfessionalAssignment: row.requires_professional_assignment ?? true,
      name: row.name,
      slug: row.slug,
      shortDescription: row.short_description,
      description: row.description,
      expectations: row.expectations,
      characteristics: row.characteristics,
      durationMinutes: row.duration_minutes,
      bufferMinutes: row.buffer_minutes,
      startIntervalMinutes: row.start_interval_minutes,
      selectionMode: row.selection_mode,
      combos: combosByTreatment.get(row.id) ?? [],
      priceCents: row.price_cents,
      preparation: row.preparation,
      contraindications: row.contraindications,
      professional: professional?.is_active
        ? professional.public_name
        : null,
      image: row.image_path && row.image_alt ? {
        src: publicImageUrl(supabase, "treatment-media", row.image_path),
        alt: row.image_alt,
        focalPoint: focalPoint(row.image_focal_x, row.image_focal_y),
        width: 1086,
        height: 1449,
      } : null,
      isActive: row.is_active,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies Treatment;
  });

  const monthlySpecials = (specialsResult.data as MonthlySpecialRow[]).map((row) => {
    return {
      id: row.id,
      treatmentId: row.treatment_id,
      title: row.title,
      shortDescription: row.short_description,
      detail: row.detail,
      pricingMode: row.pricing_mode,
      specialPriceCents: row.special_price_cents,
      referencePriceCents: row.reference_price_cents,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      image: {
        src: publicImageUrl(supabase, "treatment-media", row.image_path),
        alt: row.image_alt,
        focalPoint: focalPoint(row.image_focal_x, row.image_focal_y),
        width: 1086,
        height: 1449,
      },
      isActive: row.is_active,
      terms: row.terms,
      createdBy: null,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies MonthlySpecial;
  });

  return { categories, treatments, monthlySpecials, source: "supabase" };
});
