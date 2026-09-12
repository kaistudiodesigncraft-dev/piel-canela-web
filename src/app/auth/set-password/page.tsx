import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "../PasswordForm";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Crear contraseña administrativa" };

interface SetPasswordPageProps {
  searchParams: Promise<{ error?: string; flow?: string }>;
}

export default async function SetPasswordPage({ searchParams }: SetPasswordPageProps) {
  if (!usesSupabaseDataSource()) redirect("/admin");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/admin/login?error=session");

  const { error, flow } = await searchParams;
  return (
    <section className="admin-login-section">
      <div className="admin-login-panel">
        <p className="eyebrow">{flow === "recovery" ? "Recuperación de acceso" : "Primer acceso"}</p>
        <h1>{flow === "recovery" ? "Elegí tu nueva contraseña" : "Creá tu contraseña"}</h1>
        <p>Debe tener al menos 12 caracteres. No la compartas con Kai Studio ni con Piel Canela.</p>
        {error ? (
          <p className="form-message form-message--error" role="alert">
            Las contraseñas deben coincidir y tener al menos 12 caracteres.
          </p>
        ) : null}
        <PasswordForm />
      </div>
    </section>
  );
}
