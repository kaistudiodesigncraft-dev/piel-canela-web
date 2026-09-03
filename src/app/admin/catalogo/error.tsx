"use client";

import { AdminRouteError } from "@/components/admin/AdminRouteState";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";

export default function CatalogError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div><p className="eyebrow">Catálogo administrativo</p><h1>Gestión de tratamientos</h1><p>La sesión administrativa continúa protegida.</p></div>
      </header>
      <AdminRouteNav current="catalog" canManageAccess={false} />
      <AdminRouteError reset={reset} title="el catálogo" incidentId={error.digest} />
    </div>
  );
}
