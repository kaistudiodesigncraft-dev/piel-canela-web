import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { UniversalBookingConfigAdmin } from "@/components/admin/UniversalBookingConfigAdmin";
import { loadBookingConfigEditor } from "@/lib/admin/booking-config-editor-data";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Configurar reserva",
  description: "Configurar opciones, propuestas, precio y duración del tratamiento.",
};

export default async function BookingConfigurationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireAdmin();
  const data = await loadBookingConfigEditor(supabase, id);
  if (!data) notFound();
  return <div className="live-admin site-container">
    <header className="live-admin__header admin-editor-page-header">
      <div>
        <Link className="admin-back-link" href={`/admin/catalogo/${id}`}><ArrowLeft aria-hidden="true" strokeWidth={1.75} />Ficha del tratamiento</Link>
        <p className="eyebrow">Configuración de reserva</p>
        <h1>{data.treatment.name}</h1>
        <p>Definí cómo se elige, calcula y reserva. La agenda y los profesionales permanecen en la ficha principal.</p>
      </div>
      <Settings2 aria-hidden="true" strokeWidth={1.5} />
    </header>
    <AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} />
    <UniversalBookingConfigAdmin {...data} />
  </div>;
}
