import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { TreatmentEditor } from "@/components/admin/TreatmentEditor";
import { loadTreatmentEditorTaxonomies } from "@/lib/admin/treatment-editor-data";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Nuevo tratamiento",
  description: "Crear un tratamiento de Piel Canela.",
};

export default async function NewTreatmentPage() {
  const { supabase, profile } = await requireAdmin();
  const data = await loadTreatmentEditorTaxonomies(supabase);
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header admin-editor-page-header">
        <div>
          <Link className="admin-back-link" href="/admin/catalogo"><ArrowLeft aria-hidden="true" strokeWidth={1.75} />Catálogo</Link>
          <h1>Nuevo tratamiento</h1>
          <p>Completá la ficha y guardá tu avance como borrador. La imagen es opcional.</p>
        </div>
      </header>
      <AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} />
      <TreatmentEditor treatmentId={randomUUID()} isNew {...data} />
    </div>
  );
}
