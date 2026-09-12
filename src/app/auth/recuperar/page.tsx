import Link from "next/link";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { RecoveryForm } from "./RecoveryForm";
export const metadata = { title: "Recuperar contraseña" };
export default function RecoveryPage() {
  return <section className="admin-login-section"><div className="admin-login-panel">
    <h1>Recuperá tu acceso</h1>
    <p>Solicitá un enlace personal. Abrilo en este mismo navegador y usá siempre el último correo recibido.</p>
    {usesSupabaseDataSource() ? <RecoveryForm /> : <p>La recuperación no está disponible en el entorno de muestra.</p>}
    <Link href="/admin/login">Volver al ingreso</Link>
  </div></section>;
}
