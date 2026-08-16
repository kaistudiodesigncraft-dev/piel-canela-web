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

    async function completeInvitation() {
      try {
        const supabase = createSupabaseBrowserClient();
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

    void completeInvitation();
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
