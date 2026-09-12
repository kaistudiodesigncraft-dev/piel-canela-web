import { NextResponse } from "next/server";
import { secretsMatch, validWebhookSignature } from "@/lib/whatsapp/security";
import { createWhatsAppAdminClient } from "@/lib/whatsapp/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("hub.mode") !== "subscribe" || !secretsMatch(params.get("hub.verify_token"), process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN)) return new NextResponse(null, { status: 403 });
  return new NextResponse(params.get("hub.challenge"), { headers: { "Content-Type": "text/plain" } });
}
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 262144) return new NextResponse(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 262144) return new NextResponse(null, { status: 413 });
  if (!validWebhookSignature(body, request.headers.get("x-hub-signature-256"), process.env.WHATSAPP_APP_SECRET)) return new NextResponse(null, { status: 401 });
  let payload;
  try { payload = JSON.parse(body); } catch { return new NextResponse(null, { status: 400 }); }
  const db = createWhatsAppAdminClient();
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID || change?.value?.metadata?.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
    for (const status of Array.isArray(change.value?.statuses) ? change.value.statuses : []) {
      const prior: Record<string, string[]> = { sent: ["processing", "uncertain"], delivered: ["sent", "uncertain"], read: ["sent", "delivered", "uncertain"], failed: ["sent", "uncertain"] };
      if (typeof status?.id !== "string" || typeof status?.status !== "string") continue;
      const allowed = prior[status.status];
      if (!allowed) continue;
      const stored = await db.from("whatsapp_delivery_events").upsert({ provider_message_id: status.id, state: status.status }, { onConflict: "provider_message_id,state", ignoreDuplicates: true });
      if (stored.error) return new NextResponse(null, { status: 503 });
      const result = await db.from("whatsapp_outbox").update({ state: status.status, updated_at: new Date().toISOString() }).eq("provider_message_id", status.id).in("state", allowed);
      if (result.error) return new NextResponse(null, { status: 503 });
    }
  }
  return NextResponse.json({ received: true });
}
