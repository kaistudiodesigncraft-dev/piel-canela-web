import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInAdmin } from "../actions";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Acceso administrativo" };

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  if (!usesSupabaseDataSource()) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/admin");

  const { error } = await searchParams;
  return (
    <section className="admin-login-section">
      <div className="admin-login-panel">
        <p className="eyebrow">Administración Piel Canela</p>
        <h1>Ingresá al panel</h1>
        <p>Usá la cuenta administrativa habilitada por Kai Studio.</p>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            No pudimos iniciar sesión. Revisá los datos e intentá nuevamente.
          </p>
        ) : null}
        <form action={signInAdmin} className="admin-login-form">
          <label>
            Correo
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <button className="button button--primary" type="submit">
            Ingresar
          </button>
        </form>
      </div>
    </section>
  );
}
