"use server";

import QRCode from "qrcode";
import { z } from "zod";
import { requireOwner } from "@/lib/admin/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const activationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(180),
  fullName: z.string().trim().min(2).max(100),
});

export interface ManagerActivationState {
  status: "idle" | "error" | "ready";
  error?: "invalid" | "configuration" | "protected" | "generation" | "profile";
  fieldErrors?: Partial<Record<"email" | "fullName", string>>;
  qrDataUrl?: string;
  generatedFor?: string;
  generatedAt?: string;
  activationKind?: "invite" | "recovery";
}

export const initialManagerActivationState: ManagerActivationState = { status: "idle" };

function invalidState(error: z.ZodError<z.infer<typeof activationSchema>>): ManagerActivationState {
  const flattened = error.flatten().fieldErrors;
  return {
    status: "error",
    error: "invalid",
    fieldErrors: {
      email: flattened.email?.[0] ? "Ingresá un correo válido." : undefined,
      fullName: flattened.fullName?.[0] ? "Ingresá un nombre de 2 a 100 caracteres." : undefined,
    },
  };
}

function activationRedirectUrl() {
  const siteUrl = z.string().url().safeParse(process.env.NEXT_PUBLIC_SITE_URL);
  if (!siteUrl.success) throw new Error("site_url_not_configured");
  return new URL("/auth/complete", siteUrl.data).toString();
}

async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  throw new Error("auth_user_scan_limit");
}

export async function generateManagerActivation(
  _previousState: ManagerActivationState,
  formData: FormData,
): Promise<ManagerActivationState> {
  const { supabase: ownerSupabase, userId: ownerUserId } = await requireOwner();

  const parsed = activationSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) return invalidState(parsed.error);

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  let redirectTo: string;
  try {
    admin = createSupabaseAdminClient();
    redirectTo = activationRedirectUrl();
  } catch {
    return { status: "error", error: "configuration" };
  }

  let existingUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
  try {
    existingUser = await findAuthUserByEmail(admin, parsed.data.email);
  } catch {
    return { status: "error", error: "generation" };
  }

  let existingProfile: { full_name: string; role: "admin" | "manager"; is_active: boolean } | null = null;
  if (existingUser) {
    const { data, error: profileReadError } = await ownerSupabase
      .from("profiles")
      .select("full_name,role,is_active")
      .eq("user_id", existingUser.id)
      .maybeSingle();
    if (profileReadError) return { status: "error", error: "profile" };
    existingProfile = data;
    if (existingProfile?.role === "admin") return { status: "error", error: "protected" };
  }

  const activationKind = existingUser ? "recovery" : "invite";
  const { data: generated, error: generationError } = existingUser
    ? await admin.auth.admin.generateLink({
        type: "recovery",
        email: parsed.data.email,
        options: { redirectTo },
      })
    : await admin.auth.admin.generateLink({
        type: "invite",
        email: parsed.data.email,
        options: {
          redirectTo,
          data: { full_name: parsed.data.fullName, intended_role: "manager" },
        },
      });
  if (generationError || !generated.properties.action_link || !generated.user) {
    return { status: "error", error: "generation" };
  }

  let qrDataUrl: string;
  try {
    qrDataUrl = await QRCode.toDataURL(generated.properties.action_link, {
      errorCorrectionLevel: "M",
      margin: 3,
      width: 360,
      color: { dark: "#24322e", light: "#ffffff" },
    });
  } catch {
    return { status: "error", error: "generation" };
  }

  const createdNewAuthUser = !existingUser;
  const createdNewProfile = !existingProfile;
  const profilePayload = {
    full_name: parsed.data.fullName,
    role: "manager" as const,
    is_active: true,
  };
  const profileResult = createdNewProfile
    ? await admin.from("profiles").insert({ user_id: generated.user.id, ...profilePayload })
    : await ownerSupabase.from("profiles").update(profilePayload).eq("user_id", generated.user.id);

  if (profileResult.error) {
    if (createdNewAuthUser) await admin.auth.admin.deleteUser(generated.user.id);
    return { status: "error", error: "profile" };
  }

  if (createdNewProfile) {
    const { error: auditError } = await admin.from("audit_log").insert({
      actor_id: ownerUserId,
      table_name: "profiles",
      record_id: generated.user.id,
      action: "insert",
      old_data: null,
      new_data: {
        role: "manager",
        is_active: true,
        activation_delivery: "qr",
        activation_kind: activationKind,
      },
    });
    if (auditError) {
      await admin.from("profiles").delete().eq("user_id", generated.user.id);
      if (createdNewAuthUser) await admin.auth.admin.deleteUser(generated.user.id);
      return { status: "error", error: "profile" };
    }
  }

  return {
    status: "ready",
    qrDataUrl,
    generatedFor: parsed.data.email,
    generatedAt: new Date().toISOString(),
    activationKind,
  };
}
