import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  if (!profile?.is_active || profile.role !== "admin") {
    redirect("/admin/login?error=profile");
  }

  return { supabase, userId, profile };
}
