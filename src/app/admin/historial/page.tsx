import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminHistory } from "@/components/admin/AdminHistory";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import type { OperationalAuditRecord } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Historial administrativo",
  description: "Historial recuperable de tratamientos y profesionales de Piel Canela.",
};

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase, profile } = await requireAdmin();
  const [auditResult, profilesResult] = await Promise.all([
    supabase.rpc("list_operational_audit_history", { result_limit: 250 }),
    supabase.from("profiles").select("user_id,full_name"),
  ]);
  if (auditResult.error) throw new Error(`No se pudo cargar el historial: ${auditResult.error.message}`);

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Historial del panel</p>
          <h1>Recuperá cambios importantes sin tocar reservas.</h1>
          <p>{profile.full_name}, usá esta sección para revisar ediciones y restaurar versiones anteriores de tratamientos o profesionales cuando haga falta.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link>
          <form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form>
        </div>
      </header>
      <AdminRouteNav current="history" canManageAccess={profile.role === "admin"} />
      <AdminHistory
        events={(auditResult.data ?? []) as OperationalAuditRecord[]}
        profiles={(profilesResult.data ?? [])}
        feedback={await searchParams}
      />
    </div>
  );
}
