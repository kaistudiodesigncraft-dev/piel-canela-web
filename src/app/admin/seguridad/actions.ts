"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/admin/require-admin";

const profileSchema = z.object({
  userId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "manager"]),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

function governanceRedirect(params: string): never {
  redirect(`/admin/seguridad?${params}#accesos`);
}

export async function updateAdminProfile(formData: FormData) {
  const { supabase, userId } = await requireOwner();
  const parsed = profileSchema.safeParse({
    userId: formData.get("userId"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) governanceRedirect("profileError=invalid");
  if (parsed.data.userId === userId && (!parsed.data.isActive || parsed.data.role !== "admin")) governanceRedirect("profileError=self");

  const { error } = await supabase.from("profiles").update({
    full_name: parsed.data.fullName,
    is_active: parsed.data.isActive,
    role: parsed.data.role,
  }).eq("user_id", parsed.data.userId);

  if (error) {
    const reason = error.message.includes("last_owner_required")
      ? "last"
      : error.message.includes("cannot_remove_own_owner_access")
        ? "self"
        : "save";
    governanceRedirect(`profileError=${reason}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/seguridad");
  governanceRedirect(`profileSaved=1&profile=${parsed.data.userId}`);
}
