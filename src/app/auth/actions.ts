"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOperationalAdminRole } from "@/lib/admin/require-admin";

const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "password_mismatch",
  });

export interface PasswordResult { status: "idle" | "error" | "saved"; message: string }

export async function setAdminPassword(_previous: PasswordResult, formData: FormData): Promise<PasswordResult> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Las contraseñas deben coincidir y tener entre 12 y 128 caracteres." };
  try {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return { status: "error", message: "La sesión venció. Solicitá un nuevo enlace para recuperar tu contraseña." };
  const { data: profile } = await supabase.from("profiles").select("is_active,role").eq("user_id", claimsData.claims.sub).maybeSingle();
  if (!profile?.is_active || !isOperationalAdminRole(profile.role)) return { status: "error", message: "Esta cuenta no tiene acceso administrativo activo. Contactá a Kai Studio." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: error.code === "same_password" ? "Elegí una contraseña diferente de la actual." : "No pudimos guardar la contraseña. Intentá nuevamente o solicitá un nuevo enlace." };
  return { status: "saved", message: "Tu contraseña se actualizó correctamente." };
  } catch {
    return { status: "error", message: "No pudimos conectar. Tus campos se conservan: intentá nuevamente." };
  }
}
