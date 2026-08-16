import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

export function createSupabasePublicServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase no está configurado para este entorno.");
  }

  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
