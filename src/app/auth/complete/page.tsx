"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function CompleteAuthPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);
  const exchange = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let active = true;

    async function completeAuthentication() {
        const supabase = createSupabaseBrowserClient();
        const query = new URLSearchParams(window.location.search);
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const callbackError = query.get("error_description") ?? fragment.get("error_description");
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        const authorizationCode = query.get("code");
        const flow = fragment.get("type") === "recovery" || query.get("flow") === "recovery" ? "recovery" : "invite";

        window.history.replaceState(null, "", "/auth/complete");
        if (callbackError) {
          throw new Error("invalid_link");
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (authorizationCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authorizationCode);
          if (error) throw error;
        }

        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          throw new Error("missing_session");
        }
        return `/auth/set-password?flow=${flow}`;
    }
    // A PKCE code is single-use. Reuse the exchange across Strict Mode effect replay.
    exchange.current ??= completeAuthentication();
    void exchange.current.then((destination) => {
      if (active) {
        router.replace(destination);
        router.refresh();
      }
    }).catch(() => { if (active) setHasError(true); });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="admin-login-section" aria-live="polite">
      <div className="admin-login-panel">
        <p className="eyebrow">Acceso administrativo</p>
        <h1>{hasError ? "No pudimos validar el enlace" : "Validando tu acceso"}</h1>
        {hasError ? (
          <>
            <p>El enlace puede haber vencido o ya haber sido utilizado.</p>
            <Link className="button button--primary" href="/auth/recuperar">Solicitar un nuevo enlace</Link>
            <Link className="button button--primary" href="/admin/login">
              Volver al ingreso
            </Link>
          </>
        ) : (
          <p>En unos segundos vas a poder crear tu contraseña.</p>
        )}
      </div>
    </section>
  );
}
