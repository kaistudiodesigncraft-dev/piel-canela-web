import { OCCUPYING_BOOKING_STATUSES } from "@/lib/admin/catalog";
import type {
  AdminCategoryRow,
  AdminProfessionalRow,
  AdminSpecialtyRow,
  AdminTreatmentRow,
} from "@/lib/admin/treatment-editor-types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const treatmentSelect = "id,category_id,specialty_id,professional_id,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order";

export async function loadTreatmentEditorTaxonomies(supabase: SupabaseServerClient) {
  const [categoriesResult, specialtiesResult, professionalsResult] = await Promise.all([
    supabase.from("treatment_categories").select("id,name,slug,short_description,icon_name,display_order,is_active").order("display_order"),
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,is_active").order("display_order"),
  ]);
  const error = categoriesResult.error ?? specialtiesResult.error ?? professionalsResult.error;
  if (error) throw new Error(`treatment_editor_taxonomies:${error.code ?? "query"}`);
  return {
    categories: (categoriesResult.data ?? []) as AdminCategoryRow[],
    specialties: (specialtiesResult.data ?? []) as AdminSpecialtyRow[],
    professionals: (professionalsResult.data ?? []) as AdminProfessionalRow[],
  };
}

export async function loadTreatmentForEditor(supabase: SupabaseServerClient, treatmentId: string) {
  const [treatmentResult, bookingsResult] = await Promise.all([
    supabase.from("treatments").select(treatmentSelect).eq("id", treatmentId).single(),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("treatment_id", treatmentId)
      .in("status", [...OCCUPYING_BOOKING_STATUSES])
      .gte("starts_at", new Date().toISOString()),
  ]);
  if (treatmentResult.error || !treatmentResult.data) return null;
  const row = treatmentResult.data;
  const imageUrl = row.image_path
    ? row.image_path.startsWith("/") || row.image_path.startsWith("https://")
      ? row.image_path
      : supabase.storage.from("treatment-media").getPublicUrl(row.image_path).data.publicUrl
    : null;
  return {
    ...row,
    image_url: imageUrl,
    future_booking_count: bookingsResult.count ?? 0,
    future_booking_count_available: !bookingsResult.error,
  } as AdminTreatmentRow;
}
