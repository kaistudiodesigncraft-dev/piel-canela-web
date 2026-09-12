"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/require-admin";
import { MESSAGE_EVENTS } from "@/domain/whatsapp";
import { validateTemplate } from "@/lib/whatsapp/templates";

export async function saveMessageTemplate(_previous: { error?: string; saved?: boolean }, form: FormData): Promise<{ error?: string; saved?: boolean }> {
  const { supabase } = await requireAdmin();
  const treatmentId = String(form.get("treatmentId") ?? "");
  const event = String(form.get("event") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(treatmentId) || !(MESSAGE_EVENTS as readonly string[]).includes(event)) return { error: "Seleccioná un tratamiento y un tipo de mensaje." };
  const error = validateTemplate(body);
  if (error) return { error };
  let result;
  try {
    result = await supabase.rpc("save_treatment_message_template", { requested_treatment_id: treatmentId, requested_event: event, requested_body: body });
  } catch {
    return { error: "La conexión se interrumpió. El texto sigue en el editor; intentá nuevamente." };
  }
  if (result.error) return { error: "No se pudo guardar. El texto sigue en el editor; intentá nuevamente." };
  revalidatePath("/admin/mensajes");
  revalidatePath("/reservar");
  return { saved: true };
}

export async function retryMessage(_previous: { error?: string; saved?: boolean }, form: FormData): Promise<{ error?: string; saved?: boolean }> {
  const { supabase } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const reason = String(form.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || reason.length < 5 || reason.length > 240) return { error: "Indicá el motivo del reintento (5 a 240 caracteres)." };
  try {
    const result = await supabase.rpc("retry_whatsapp_message", { requested_id: id, requested_reason: reason });
    if (result.error) return { error: "No se puede reintentar: revisá el estado y el límite de intentos." };
    revalidatePath("/admin/mensajes");
    return { saved: true };
  } catch { return { error: "No se pudo consultar el estado. Reintentá más tarde." }; }
}
