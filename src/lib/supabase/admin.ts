import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const adminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(24),
});

export function createSupabaseAdminClient() {
  const parsed = adminEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!parsed.success) throw new Error("supabase_admin_not_configured");

  return createClient(parsed.data.NEXT_PUBLIC_SUPABASE_URL, parsed.data.SUPABASE_SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
