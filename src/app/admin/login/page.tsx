import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signInAdmin } from "../actions";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isOperationalAdminRole } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Acceso administrativo" };

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const isConfigured = usesSupabaseDataSource();

  if (isConfigured) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active,role")
        .eq("user_id", userId)
        .maybeSingle();

      if (profile?.is_active && isOperationalAdminRole(profile.role)) {
        redirect("/admin");
      }
    }
  }

  const { error } = await searchParams;
  return (
    <section className="admin-login-section">
      <div className="admin-login-panel">
        <p className="eyebrow">Administración Piel Canela</p>
        <h1>Ingresá al panel</h1>
        <p>Acceso exclusivo para el equipo autorizado.</p>
        {!isConfigured || error === "configuration" ? (
          <p className="form-message form-message--error" role="alert">
            El entorno administrativo todavía no está configurado.
          </p>
        ) : error ? (
          <p className="form-message form-message--error" role="alert">
            No pudimos iniciar sesión. Revisá los datos e intentá nuevamente.
          </p>
        ) : null}
        {isConfigured ? <form action={signInAdmin} className="admin-login-form">
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
        </form> : null}
      </div>
    </section>
  );
}
