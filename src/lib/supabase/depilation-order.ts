import "server-only";
import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { calculateOrderTotal } from "@/lib/depilation-order";
import { createSupabasePublicServerClient } from "./public-server";

const zone = z.object({ id: z.string().uuid(), name: z.string(), priceCents: z.number().int().positive(), durationMinutes: z.number().int().positive() });
const contextSchema = z.object({
  treatmentId: z.string().uuid(), treatmentName: z.string(), specialtyId: z.string().uuid(),
  bufferMinutes: z.number().int().nonnegative(), startIntervalMinutes: z.number().int().positive(),
  combo: zone.extend({ includedZoneIds: z.array(z.string().uuid()), sessionCount: z.number().int().positive() }).nullable(),
  zones: z.array(zone), includedZones: z.array(zone),
  comboMode: z.enum(["single_session","package"]).nullable(), comboAudience: z.string().nullable(),
  validityDays: z.number().nullable(), discountPercent: z.number().min(0).max(100), version: z.string(),
});

export async function createZoneOrderQuote(treatmentId: string, comboId: string | null, zoneIds: readonly string[], secret: string) {
  if (process.env.DEPILATION_ZONES_ENABLED !== "true") throw new Error("zone_order_disabled");
  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.rpc("get_depilation_order_context", {
    requested_treatment_id: treatmentId, requested_combo_id: comboId, requested_zone_ids: [...zoneIds],
  });
  if (error) throw new Error("zone_order_unavailable");
  const context = contextSchema.parse(data);
  const order = calculateOrderTotal(context);
  const payload = JSON.stringify({ purpose: "depilation-order-v1", expiresAt: new Date(Date.now()+15*60_000).toISOString(), zoneIds, context, order });
  const key = createHash("sha256").update(secret).digest("hex");
  const signature = createHmac("sha256",key).update(payload).digest("hex");
  return {payload,signature,order};
}
