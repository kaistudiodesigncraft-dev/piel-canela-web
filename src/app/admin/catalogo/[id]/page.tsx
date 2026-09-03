import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { TreatmentEditor } from "@/components/admin/TreatmentEditor";
import { loadTreatmentEditorTaxonomies, loadTreatmentForEditor } from "@/lib/admin/treatment-editor-data";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Editar tratamiento",
  description: "Editar un tratamiento de Piel Canela.",
};

export default async function EditTreatmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireAdmin();
  const [data, treatment] = await Promise.all([
    loadTreatmentEditorTaxonomies(supabase),
    loadTreatmentForEditor(supabase, id),
  ]);
  if (!treatment) notFound();
  const feedback = await searchParams;
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header admin-editor-page-header">
        <div>
          <Link className="admin-back-link" href="/admin/catalogo"><ArrowLeft aria-hidden="true" strokeWidth={1.75} />Catálogo</Link>
          <p className="eyebrow">Editar tratamiento</p>
          <h1>{treatment.name}</h1>
          <p>La ficha pública y las reglas de agenda se guardan juntas, sin alterar las reservas existentes.</p>
        </div>
        <div className="live-admin__actions"><Link className="button button--quiet" href={`/tratamientos/${treatment.slug}`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver ficha pública</Link></div>
      </header>
      <AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} />
      {feedback.saved === "1" ? <p className="form-message" role="status">El borrador quedó guardado.</p> : null}
      {feedback.published === "1" ? <p className="form-message" role="status">El tratamiento está publicado.</p> : null}
      <TreatmentEditor treatmentId={id} isNew={false} treatment={treatment} {...data} />
    </div>
  );
}
