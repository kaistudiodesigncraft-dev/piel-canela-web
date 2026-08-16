"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function CompleteAuthPage() {
  const router = useRouter();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeAuthentication() {
      try {
        const supabase = createSupabaseBrowserClient();
        const query = new URLSearchParams(window.location.search);
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const callbackError = query.get("error_description") ?? fragment.get("error_description");
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");
        const authorizationCode = query.get("code");

        window.history.replaceState(null, "", "/auth/complete");
        if (callbackError) {
          setHasError(true);
          return;
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

        if (!active) return;
        if (error || !data.session) {
          setHasError(true);
          return;
        }

        router.replace("/auth/set-password");
        router.refresh();
      } catch {
        if (active) setHasError(true);
      }
    }

    void completeAuthentication();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <section className="admin-login-section" aria-live="polite">
      <div className="admin-login-panel">
        <p className="eyebrow">Acceso administrativo</p>
        <h1>{hasError ? "No pudimos validar la invitación" : "Validando tu invitación"}</h1>
        {hasError ? (
          <>
            <p>El enlace puede haber vencido o ya haber sido utilizado.</p>
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
