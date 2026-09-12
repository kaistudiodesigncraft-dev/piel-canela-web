import { NextResponse } from "next/server";
import { createWhatsAppAdminClient } from "@/lib/whatsapp/server";
import { secretsMatch } from "@/lib/whatsapp/security";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/templates";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const workerSecret = process.env.WHATSAPP_WORKER_SECRET;
  if (!workerSecret || workerSecret.length < 32 || !secretsMatch(request.headers.get("authorization"), `Bearer ${workerSecret}`)) return new NextResponse(null, { status: 401 });
  if (process.env.WHATSAPP_AUTOMATION_ENABLED !== "true") return NextResponse.json({ enabled: false });
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_VERSION;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE;
  if (!token || !phoneId?.match(/^\d+$/) || !version?.match(/^v\d+\.\d+$/) || !language) return NextResponse.json({ error: "configuration_missing" }, { status: 503 });
  const db = createWhatsAppAdminClient();
  const claimed = await db.rpc("claim_whatsapp_outbox");
  if (claimed.error) return NextResponse.json({ error: "queue_unavailable" }, { status: 503 });
  for (const item of claimed.data ?? []) {
    // Fetch again after claiming: never rely on the original enqueue snapshot for eligibility.
    const [booking, consent] = await Promise.all([
      db.from("bookings").select("id,status,starts_at,booking_code,treatment_name_snapshot,combo_name_snapshot,customers(full_name,phone)").eq("id", item.booking_id).single(),
      db.from("booking_whatsapp_consents").select("revoked_at").eq("booking_id", item.booking_id).single(),
    ]);
    const update = async (state: string, failure_code: string | null = null, provider_message_id?: string) => {
      await db.from("whatsapp_outbox").update({ state, failure_code, provider_message_id, updated_at: new Date().toISOString() }).eq("id", item.id).eq("state", "processing");
    };
    if (booking.error || consent.error) { await update("failed", "validation_unavailable"); continue; }
    const b = booking.data;
    if (!b || !consent.data || consent.data.revoked_at || !["pending", "awaiting_deposit", "confirmed"].includes(b.status) || new Date(b.starts_at).getTime() !== new Date(item.booking_starts_at).getTime() || new Date(b.starts_at).getTime() <= Date.now() || (item.event !== "pre_reservation" && b.status !== "confirmed") || (item.event === "pre_reservation" && b.status === "confirmed")) { await update("cancelled"); continue; }
    const customer = Array.isArray(b.customers) ? b.customers[0] : b.customers;
    const phone = normalizeWhatsAppPhone(customer?.phone ?? "");
    const template = process.env[`WHATSAPP_TEMPLATE_${String(item.event).toUpperCase()}`];
    if (!phone || !template?.match(/^[a-z0-9_]+$/)) { await update("failed", "recipient_or_template_invalid"); continue; }
    const recorded = await db.from("whatsapp_outbox").update({ provider_template_name: template, provider_template_language: language }).eq("id", item.id).eq("state", "processing").select("id").single();
    if (recorded.error || !recorded.data) continue;
    try {
      // Approved template contract: name, treatment, local date/time, booking code.
      // No free-form admin body is sent to the provider.
      const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "template", template: { name: template, language: { code: language }, components: [{ type: "body", parameters: [customer?.full_name ?? "", [b.treatment_name_snapshot, b.combo_name_snapshot].filter(Boolean).join(" · "), new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Cordoba", dateStyle: "short", timeStyle: "short" }).format(new Date(b.starts_at)), b.booking_code].map((text) => ({ type: "text", text })) }] } }),
      });
      if (!response.ok) { await update(response.status >= 500 ? "uncertain" : "failed", `provider_http_${response.status}`); continue; }
      const payload = await response.json();
      const messageId = payload.messages?.[0]?.id;
      if (typeof messageId !== "string") { await update("uncertain", "missing_provider_id"); continue; }
      await update("sent", null, messageId);
    } catch { await update("uncertain", "transport_uncertain"); }
  }
  return NextResponse.json({ processed: claimed.data?.length ?? 0 });
}
