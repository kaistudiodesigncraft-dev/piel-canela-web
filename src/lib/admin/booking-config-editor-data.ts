import { BookingConfigSchema, resolveTreatmentConfig } from "@/lib/booking-config";
import type {
  BookingConfigCombinationRow,
  BookingConfigOptionRow,
  BookingConfigTreatmentRow,
} from "./booking-config-editor-types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function loadBookingConfigEditor(
  supabase: SupabaseServerClient,
  treatmentId: string,
): Promise<{
  treatment: BookingConfigTreatmentRow;
  options: BookingConfigOptionRow[];
  combinations: BookingConfigCombinationRow[];
} | null> {
  const [treatmentResult, optionsResult, combinationsResult, itemsResult, bookingsResult] = await Promise.all([
    supabase.from("treatments")
      .select("id,name,slug,selection_mode,booking_config,config_enabled,price_cents,duration_minutes,is_active,updated_at")
      .eq("id", treatmentId)
      .maybeSingle(),
    supabase.from("treatment_options")
      .select("id,treatment_id,name,description,price_cents,duration_minutes,display_order,is_active,updated_at")
      .eq("treatment_id", treatmentId)
      .order("display_order")
      .order("name"),
    supabase.from("treatment_option_combos")
      .select("id,treatment_id,name,description,kind,price_cents,duration_minutes,session_count,display_order,is_active,updated_at")
      .eq("treatment_id", treatmentId)
      .order("display_order")
      .order("name"),
    supabase.from("treatment_option_combo_items")
      .select("combo_id,option_id,role,display_order")
      .eq("treatment_id", treatmentId)
      .order("display_order"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("treatment_id", treatmentId),
  ]);

  if (treatmentResult.error) throw new Error(`booking_config_treatment:${treatmentResult.error.code ?? "query"}`);
  if (!treatmentResult.data) return null;
  const relatedError = optionsResult.error ?? combinationsResult.error ?? itemsResult.error ?? bookingsResult.error;
  if (relatedError) throw new Error(`booking_config_catalog:${relatedError.code ?? "query"}`);

  const row = treatmentResult.data;
  const parsedConfig = BookingConfigSchema.safeParse(row.booking_config);
  const resolved = parsedConfig.success
    ? parsedConfig.data
    : resolveTreatmentConfig({
      config_enabled: false,
      booking_config: null,
      selection_mode: row.selection_mode,
      price_cents: row.price_cents,
      duration_minutes: row.duration_minutes,
    }).config;
  const items = itemsResult.data ?? [];

  return {
    treatment: {
      ...row,
      booking_config: resolved,
      configuration_valid: parsedConfig.success || !row.config_enabled,
      total_booking_count: bookingsResult.count ?? 0,
    } as BookingConfigTreatmentRow,
    options: (optionsResult.data ?? []) as BookingConfigOptionRow[],
    combinations: (combinationsResult.data ?? []).map((combination) => ({
      ...combination,
      included_option_ids: items
        .filter((item) => item.combo_id === combination.id && item.role === "included")
        .map((item) => item.option_id),
      addon_option_ids: items
        .filter((item) => item.combo_id === combination.id && item.role === "addon")
        .map((item) => item.option_id),
    })) as BookingConfigCombinationRow[],
  };
}
