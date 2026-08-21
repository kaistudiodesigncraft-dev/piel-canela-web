"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

const profileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function governanceRedirect(params: string): never {
  redirect(`/admin/seguridad?${params}#accesos`);
}

export async function updateAdminProfile(formData: FormData) {
  const { supabase, userId } = await requireAdmin();
  const parsed = profileSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) governanceRedirect("profileError=invalid");
  if (parsed.data.userId === userId && !parsed.data.isActive) governanceRedirect("profileError=self");

  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    is_active: parsed.data.isActive,
  }).eq("user_id", parsed.data.userId);

  if (error) {
    const reason = error.message.includes("last_admin_required")
      ? "last"
      : error.message.includes("cannot_disable_self")
        ? "self"
        : "save";
    governanceRedirect(`profileError=${reason}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/seguridad");
  governanceRedirect(`profileSaved=1&profile=${parsed.data.userId}`);
}
