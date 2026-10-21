"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function saveDepilationDiscount(input: unknown): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireAdmin();
  if (process.env.DEPILATION_ZONES_ENABLED !== "true") return { ok: false, message: "Esta configuración todavía no está habilitada." };
  const parsed = z.object({ percent: z.number().min(0).max(100).multipleOf(0.01) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Ingresá un porcentaje entre 0 y 100, con hasta dos decimales." };
  const { data, error } = await supabase.from("business_settings")
    .update({ depilation_discount_percent: parsed.data.percent }).eq("singleton", true).select("singleton").maybeSingle();
  if (error || !data) return { ok: false, message: "No pudimos guardar el porcentaje. Tu valor sigue en pantalla; reintentá." };
  revalidatePath("/admin/catalogo", "layout");
  revalidatePath("/tratamientos");
  revalidatePath("/tratamientos/[slug]", "page");
  revalidatePath("/reservar");
  return { ok: true, message: "Descuento guardado. Solo se aplica a nuevas pre-reservas; las existentes conservan sus valores." };
}
