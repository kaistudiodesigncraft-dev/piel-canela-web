import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setAdminPassword } from "../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear contraseña administrativa" };

interface SetPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login?error=session");

  const { error } = await searchParams;
  return (
    <section className="admin-login-section">
      <div className="admin-login-panel">
        <p className="eyebrow">Primer acceso</p>
        <h1>Creá tu contraseña</h1>
        <p>Debe tener al menos 12 caracteres. No la compartas con Kai Studio ni con Piel Canela.</p>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            Las contraseñas deben coincidir y tener al menos 12 caracteres.
          </p>
        ) : null}
        <form action={setAdminPassword} className="admin-login-form">
          <label>
            Nueva contraseña
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Repetir contraseña
            <input
              name="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <button className="button button--primary" type="submit">
            Guardar y entrar
          </button>
        </form>
      </div>
    </section>
  );
}
