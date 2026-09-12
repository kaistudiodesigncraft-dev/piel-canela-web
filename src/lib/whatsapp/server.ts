import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MessageTemplates } from "@/domain/whatsapp";

export async function getTreatmentMessageTemplates(treatmentId: string): Promise<MessageTemplates> {
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("treatment_message_templates").select("event,body").eq("treatment_id", treatmentId);
    if (error) return {};
    return Object.fromEntries((data ?? []).map((row) => [row.event, row.body]));
  } catch { return {}; }
}

export function createWhatsAppAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("whatsapp_configuration_missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
