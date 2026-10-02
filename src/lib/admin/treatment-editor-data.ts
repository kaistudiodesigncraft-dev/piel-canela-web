import { OCCUPYING_BOOKING_STATUSES } from "@/lib/admin/catalog";
import type {
  AdminCategoryRow,
  AdminProfessionalRow,
  AdminSpecialtyRow,
  AdminTreatmentRow,
} from "@/lib/admin/treatment-editor-types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const treatmentSelect = "id,updated_at,category_id,specialty_id,professional_id,requires_professional_assignment,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,selection_mode,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order";

export async function loadTreatmentEditorTaxonomies(supabase: SupabaseServerClient) {
  const [categoriesResult, specialtiesResult, professionalsResult, professionalSpecialtiesResult] = await Promise.all([
    supabase.from("treatment_categories").select("id,name,slug,short_description,icon_name,display_order,is_active").order("display_order"),
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,is_active").order("display_order"),
    supabase.from("professional_specialties").select("professional_id,specialty_id"),
  ]);
  const error = categoriesResult.error ?? specialtiesResult.error ?? professionalsResult.error ?? professionalSpecialtiesResult.error;
  if (error) throw new Error(`treatment_editor_taxonomies:${error.code ?? "query"}`);
  const specialtyIdsByProfessional = new Map<string, string[]>();
  for (const relation of professionalSpecialtiesResult.data ?? []) {
    const current = specialtyIdsByProfessional.get(relation.professional_id) ?? [];
    if (!current.includes(relation.specialty_id)) current.push(relation.specialty_id);
    specialtyIdsByProfessional.set(relation.professional_id, current);
  }
  const professionals = (professionalsResult.data ?? []).map((professional) => ({
    ...professional,
    specialty_ids: [...new Set([
      professional.specialty_id,
      ...(specialtyIdsByProfessional.get(professional.id) ?? []),
    ])],
  }));
  return {
    categories: (categoriesResult.data ?? []) as AdminCategoryRow[],
    specialties: (specialtiesResult.data ?? []) as AdminSpecialtyRow[],
    professionals: professionals as AdminProfessionalRow[],
  };
}

export async function loadTreatmentForEditor(supabase: SupabaseServerClient, treatmentId: string) {
  const [treatmentResult, bookingsResult, treatmentProfessionalsResult] = await Promise.all([
    supabase.from("treatments").select(treatmentSelect).eq("id", treatmentId).single(),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("treatment_id", treatmentId)
      .in("status", [...OCCUPYING_BOOKING_STATUSES])
      .gte("starts_at", new Date().toISOString()),
    supabase.from("treatment_professionals").select("professional_id").eq("treatment_id", treatmentId).eq("is_active", true),
  ]);
  if (treatmentResult.error) {
    if (treatmentResult.error.code === "PGRST116") return null;
    throw new Error(`treatment_editor_record:${treatmentResult.error.code ?? "query"}`);
  }
  if (!treatmentResult.data) return null;
  // Never present an empty assignment list when its authoritative query failed.
  if (treatmentProfessionalsResult.error) {
    throw new Error(`treatment_editor_assignments:${treatmentProfessionalsResult.error.code ?? "query"}`);
  }
  const row = treatmentResult.data;
  const imageUrl = row.image_path
    ? row.image_path.startsWith("/") || row.image_path.startsWith("https://")
      ? row.image_path
      : supabase.storage.from("treatment-media").getPublicUrl(row.image_path).data.publicUrl
    : null;
  return {
    ...row,
    professional_ids: (treatmentProfessionalsResult.data ?? []).map((item) => item.professional_id).concat(
      row.professional_id && !(treatmentProfessionalsResult.data ?? []).some((item) => item.professional_id === row.professional_id) ? [row.professional_id] : [],
    ),
    image_url: imageUrl,
    future_booking_count: bookingsResult.count ?? 0,
    future_booking_count_available: !bookingsResult.error,
  } as AdminTreatmentRow;
}
