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
          <p className="eyebrow">Nuevo tratamiento</p>
          <h1>Prepará la ficha antes de publicarla.</h1>
          <p>{profile.full_name}, podés guardar un borrador aunque todavía falten imagen, precio o texto accesible.</p>
        </div>
      </header>
      <AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} />
      <TreatmentEditor treatmentId={randomUUID()} isNew {...data} />
    </div>
  );
}
