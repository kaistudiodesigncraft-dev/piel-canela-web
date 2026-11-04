import "server-only";

import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import type { TreatmentSelectionMode } from "@/domain/treatment";
import { BookingConfigSchema } from "@/lib/booking-config";
import { calculateOrder } from "@/lib/booking-engine";
import { GenericCatalog } from "@/lib/option-catalog";
import { createZoneOrderQuote } from "./depilation-order";
import { createSupabasePublicServerClient } from "./public-server";

const optionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  priceCents: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  displayOrder: z.number().int().nonnegative(),
  isActive: z.literal(true),
});

const combinationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  kind: z.enum(["combo", "package"]),
  priceCents: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  includedOptionIds: z.array(z.string().uuid()),
  allowedAddonOptionIds: z.array(z.string().uuid()),
  sessionCount: z.number().int().positive(),
}).nullable();

const contextSchema = z.object({
  source: z.literal("configured"),
  treatmentId: z.string().uuid(),
  treatmentName: z.string().min(1),
  specialtyId: z.string().uuid(),
  requiresProfessionalAssignment: z.boolean(),
  bufferMinutes: z.number().int().nonnegative(),
  startIntervalMinutes: z.number().int().positive(),
  bookingConfig: z.unknown(),
  selection: z.object({
    combinationId: z.string().uuid().nullable(),
    optionIds: z.array(z.string().uuid()).max(100),
  }),
  combination: combinationSchema,
  options: z.array(optionSchema),
  includedOptions: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    priceCents: z.number().int().positive(),
    durationMinutes: z.number().int().positive(),
  })),
  version: z.string().min(1),
});

export interface BookingOrderSelectionV2 {
  treatmentId: string;
  combinationId: string | null;
  optionIds: readonly string[];
}

export async function createBookingOrderQuoteV2(
  selection: BookingOrderSelectionV2,
  secret: string,
) {
  if (secret.length < 32) throw new Error("booking_guard_not_configured");
  const supabase = createSupabasePublicServerClient();
  const { data, error } = await supabase.rpc("get_booking_order_context_v2", {
    requested_treatment_id: selection.treatmentId,
    requested_combination_id: selection.combinationId,
    requested_option_ids: [...selection.optionIds],
  });
  if (error) throw new Error(error.message || "booking_order_unavailable");

  const context = contextSchema.parse(data);
  const config = BookingConfigSchema.parse(context.bookingConfig);
  const catalog = new GenericCatalog(
    context.treatmentId,
    context.options.map((option) => ({
      id: option.id,
      treatment_id: context.treatmentId,
      name: option.name,
      price_cents: option.priceCents,
      duration_minutes: option.durationMinutes,
      display_order: option.displayOrder,
      is_active: option.isActive,
    })),
    context.combination ? [{
      id: context.combination.id,
      treatment_id: context.treatmentId,
      name: context.combination.name,
      kind: context.combination.kind,
      price_cents: context.combination.priceCents,
      duration_minutes: context.combination.durationMinutes,
      included_option_ids: context.combination.includedOptionIds,
      allowed_addon_option_ids: context.combination.allowedAddonOptionIds,
      session_count: context.combination.sessionCount,
      display_order: 0,
      is_active: true,
    }] : [],
  );
  const order = calculateOrder(config, catalog, {
    combinationId: context.selection.combinationId,
    optionIds: context.selection.optionIds,
  });
  const payload = JSON.stringify({
    purpose: "booking-order-v2",
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    selection: context.selection,
    context,
    order,
  });
  const key = createHash("sha256").update(secret).digest("hex");
  const signature = createHmac("sha256", key).update(payload).digest("hex");
  return { payload, signature, order };
}

export type RoutedBookingOrderQuote =
  | { path: "configured"; quote: Awaited<ReturnType<typeof createBookingOrderQuoteV2>> }
  | { path: "legacy"; quote: Awaited<ReturnType<typeof createZoneOrderQuote>> };

/**
 * Selects a booking engine from explicit configuration state only. It never
 * identifies Depilation by slug, name or ID, and it leaves simple legacy
 * treatments on their existing reservation path.
 */
export async function createRoutedBookingOrderQuote(input: {
  configEnabled: boolean;
  selectionMode: TreatmentSelectionMode;
  selection: BookingOrderSelectionV2;
  secret: string;
}): Promise<RoutedBookingOrderQuote> {
  if (input.configEnabled) {
    return {
      path: "configured",
      quote: await createBookingOrderQuoteV2(input.selection, input.secret),
    };
  }
  if (input.selectionMode !== "simple") {
    return {
      path: "legacy",
      quote: await createZoneOrderQuote(
        input.selection.treatmentId,
        input.selection.combinationId,
        input.selection.optionIds,
        input.secret,
      ),
    };
  }
  throw new Error("simple_flow_required");
}
