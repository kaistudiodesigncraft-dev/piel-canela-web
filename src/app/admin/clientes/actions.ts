"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";

const customerSchema = z.object({
  customerId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(180).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

function customerRedirect(params: string): never {
  redirect(`/admin/clientes?${params}#directorio`);
}

export async function saveCustomer(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = customerSchema.safeParse({
    customerId: formData.get("customerId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") || undefined,
    internalNotes: formData.get("internalNotes") || undefined,
  });
  if (!parsed.success) customerRedirect("customerError=invalid");
  const { error } = await supabase.from("customers").update({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    internal_notes: parsed.data.internalNotes || null,
  }).eq("id", parsed.data.customerId);
  if (error) customerRedirect("customerError=save");
  revalidatePath("/admin");
  revalidatePath("/admin/clientes");
  customerRedirect(`customerSaved=1&customer=${parsed.data.customerId}`);
}
