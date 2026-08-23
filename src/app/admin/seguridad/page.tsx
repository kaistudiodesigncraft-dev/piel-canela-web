import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import {
  GovernanceAdmin,
  type AdminProfileRow,
} from "@/components/admin/GovernanceAdmin";
import type { AuditRecord } from "@/lib/admin/audit";
import { requireOwner } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Accesos y actividad",
  description: "Gobierno de accesos y trazabilidad administrativa de Piel Canela.",
};

export default async function GovernancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { supabase, profile, userId } = await requireOwner();
  const [profilesResult, auditResult] = await Promise.all([
    supabase.from("profiles")
      .select("user_id,full_name,role,is_active,created_at,updated_at")
      .order("created_at"),
    supabase.from("audit_log")
      .select("id,actor_id,table_name,record_id,action,old_data,new_data,created_at")
      .order("created_at", { ascending: false })
      .limit(250),
  ]);

  const firstError = profilesResult.error ?? auditResult.error;
  if (firstError) throw new Error(`No se pudo cargar la trazabilidad: ${firstError.message}`);

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Gobierno administrativo</p>
          <h1>Accesos claros y cada cambio identificable.</h1>
          <p>{profile.full_name}, esta sección protege quién puede operar y permite reconstruir las decisiones importantes.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver sitio</Link>
          <form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form>
        </div>
      </header>
      <AdminRouteNav current="governance" canManageAccess />
      <GovernanceAdmin
        currentUserId={userId}
        profiles={(profilesResult.data ?? []) as AdminProfileRow[]}
        events={(auditResult.data ?? []) as AuditRecord[]}
        feedback={await searchParams}
      />
    </div>
  );
}
