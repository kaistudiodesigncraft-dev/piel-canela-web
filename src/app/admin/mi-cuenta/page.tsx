import Link from "next/link";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { requireAdmin } from "@/lib/admin/require-admin";
import { signOutAdmin } from "../actions";
export const metadata = { title: "Mi cuenta" };
export default async function AccountPage() {
  const { profile } = await requireAdmin();
  return <section className="live-admin site-container"><h1>Mi cuenta</h1>
    <AdminRouteNav current="account" canManageAccess={profile.role === "admin"} />
    <p>{profile.full_name}</p>
    <h2>Contraseña y acceso</h2>
    <p>Para cambiar la contraseña actual, solicitá un enlace personal por correo. No compartas el enlace ni tu contraseña.</p>
    <Link className="button button--primary" href="/auth/recuperar">Cambiar contraseña por correo</Link>
    <form action={signOutAdmin}><button className="button button--secondary" type="submit">Cerrar sesión</button></form>
  </section>;
}
