"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const availabilityRuleSchema = z.object({
  specialtyId: z.string().uuid(),
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120),
});

export async function signInAdmin(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/login?error=invalid");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect("/admin/login?error=credentials");
  redirect("/admin");
}

export async function signOutAdmin() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export async function createAvailabilityRule(formData: FormData) {
  const parsed = availabilityRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || parsed.data.startTime >= parsed.data.endTime) {
    redirect("/admin?availabilityError=invalid#disponibilidad");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("availability_rules").insert({
    specialty_id: parsed.data.specialtyId,
    weekday: parsed.data.weekday,
    start_time: parsed.data.startTime,
    end_time: parsed.data.endTime,
    slot_interval_minutes: parsed.data.slotIntervalMinutes,
  });
  if (error) redirect("/admin?availabilityError=save#disponibilidad");

  revalidatePath("/admin");
  redirect("/admin?availabilitySaved=1#disponibilidad");
}
export async function deleteAvailabilityRule(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin?availabilityError=invalid#disponibilidad");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("availability_rules").delete().eq("id", id.data);
  if (error) redirect("/admin?availabilityError=delete#disponibilidad");

  revalidatePath("/admin");
  redirect("/admin?availabilitySaved=1#disponibilidad");
}
