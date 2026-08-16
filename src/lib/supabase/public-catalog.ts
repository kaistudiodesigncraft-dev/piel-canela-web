import {
  monthlySpecials as fixtureMonthlySpecials,
  treatmentCategories as fixtureCategories,
  treatments as fixtureTreatments,
} from "@/data/fixtures";
import type {
  MonthlySpecial,
  Treatment,
  TreatmentCategory,
} from "@/domain/treatment";
import { createSupabaseServerClient } from "./server";
import { usesSupabaseDataSource } from "./env";

export interface PublicCatalogSnapshot {
  categories: readonly TreatmentCategory[];
  treatments: readonly Treatment[];
  monthlySpecials: readonly MonthlySpecial[];
  source: "fixtures" | "supabase";
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
  price_cents: number;
  preparation: string | null;
  contraindications: string | null;
  image_path: string;
  image_alt: string;
  image_focal_x: number | string;
  image_focal_y: number | string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface MonthlySpecialRow {
  id: string;
  treatment_id: string;
  title: string;
  short_description: string;
  detail: string;
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
  created_by: string;
  created_at: string;
  updated_at: string;
}

function focalPoint(x: number | string, y: number | string) {
  return `${Math.round(Number(x) * 100)}% ${Math.round(Number(y) * 100)}%` as const;
}

export async function getPublicCatalogSnapshot(): Promise<PublicCatalogSnapshot> {
  if (!usesSupabaseDataSource()) {
    return {
      categories: fixtureCategories,
      treatments: fixtureTreatments,
      monthlySpecials: fixtureMonthlySpecials,
      source: "fixtures",
    };
  }

  const supabase = await createSupabaseServerClient();
  const [categoriesResult, treatmentsResult, specialsResult] = await Promise.all([
    supabase
      .from("treatment_categories")
      .select("id,name,slug,short_description,icon_name,display_order,is_active")
      .order("display_order"),
    supabase
      .from("treatments")
      .select("*")
      .order("display_order"),
    supabase
      .from("monthly_specials")
      .select("*")
      .order("display_order"),
  ]);

  const firstError = categoriesResult.error ?? treatmentsResult.error ?? specialsResult.error;
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

  const treatments = (treatmentsResult.data as TreatmentRow[]).map((row) => {
    const image = supabase.storage.from("treatment-media").getPublicUrl(row.image_path);
    return {
      id: row.id,
      categoryId: row.category_id,
      specialtyId: row.specialty_id,
      professionalId: row.professional_id,
      name: row.name,
      slug: row.slug,
      shortDescription: row.short_description,
      description: row.description,
      expectations: row.expectations,
      characteristics: row.characteristics,
      durationMinutes: row.duration_minutes,
      bufferMinutes: row.buffer_minutes,
      priceCents: row.price_cents,
      preparation: row.preparation,
      contraindications: row.contraindications,
      professional: null,
      image: {
        src: image.data.publicUrl,
        alt: row.image_alt,
        focalPoint: focalPoint(row.image_focal_x, row.image_focal_y),
        width: 1086,
        height: 1449,
      },
      isActive: row.is_active,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies Treatment;
  });

  const monthlySpecials = (specialsResult.data as MonthlySpecialRow[]).map((row) => {
    const image = supabase.storage.from("treatment-media").getPublicUrl(row.image_path);
    return {
      id: row.id,
      treatmentId: row.treatment_id,
      title: row.title,
      shortDescription: row.short_description,
      detail: row.detail,
      specialPriceCents: row.special_price_cents,
      referencePriceCents: row.reference_price_cents,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      image: {
        src: image.data.publicUrl,
        alt: row.image_alt,
        focalPoint: focalPoint(row.image_focal_x, row.image_focal_y),
        width: 1086,
        height: 1449,
      },
      isActive: row.is_active,
      terms: row.terms,
      createdBy: row.created_by,
      displayOrder: row.display_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } satisfies MonthlySpecial;
  });

  return { categories, treatments, monthlySpecials, source: "supabase" };
}
