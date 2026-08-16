"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "password_mismatch",
  });

export async function setAdminPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/auth/set-password?error=invalid");

  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/admin/login?error=session");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/auth/set-password?error=save");

  redirect("/admin?welcome=1");
}
