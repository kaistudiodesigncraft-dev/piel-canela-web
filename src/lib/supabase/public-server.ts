import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./env";

export function createSupabasePublicServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase no está configurado para este entorno.");
  }

  return createClient(config.url, config.publishableKey, {
    // Live publication and permissions can change after a deployment. Never
    // freeze an anonymous catalog response (including an empty combo list)
    // into a statically generated treatment page.
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
