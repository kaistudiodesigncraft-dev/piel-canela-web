import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const OPERATIONAL_ADMIN_ROLES = ["admin", "manager"] as const;

export type OperationalAdminRole = (typeof OPERATIONAL_ADMIN_ROLES)[number];

export function isOperationalAdminRole(role: unknown): role is OperationalAdminRole {
  return typeof role === "string" && OPERATIONAL_ADMIN_ROLES.includes(role as OperationalAdminRole);
}

export function isOwnerRole(role: unknown): role is "admin" {
  return role === "admin";
}

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name,is_active,role")
    .eq("user_id", userId)
    .single();

  if (!profile?.is_active || !isOperationalAdminRole(profile.role)) {
    redirect("/admin/login?error=profile");
  }

  return { supabase, userId, profile };
}

export async function requireOwner() {
  const context = await requireAdmin();
  if (!isOwnerRole(context.profile.role)) {
    redirect("/admin?error=permission");
  }
  return context;
}
