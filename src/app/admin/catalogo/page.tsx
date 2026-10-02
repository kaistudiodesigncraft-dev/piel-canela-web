import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { AdminInlineDataError } from "@/components/admin/AdminRouteState";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";
import { OCCUPYING_BOOKING_STATUSES } from "@/lib/admin/catalog";
import {
  createCatalogCorrelationId,
  reportCatalogQueryFailure,
} from "@/lib/admin/catalog-observability";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Catálogo administrativo",
  description: "Gestión de tratamientos y categorías de Piel Canela.",
};

export default async function AdminCatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const now = new Date().toISOString();
  const correlationId = createCatalogCorrelationId();
  const [categoriesResult, specialtiesResult, professionalsResult, treatmentsResult, assignmentsResult, combosResult, bookingsResult] = await Promise.all([
    supabase.from("treatment_categories").select("id,name,slug,short_description,icon_name,display_order,is_active").order("display_order"),
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,is_active").order("display_order"),
    supabase.from("treatments").select("id,category_id,specialty_id,professional_id,requires_professional_assignment,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,start_interval_minutes,selection_mode,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order").order("display_order").order("name"),
    supabase.from("treatment_professionals").select("treatment_id,professional_id").eq("is_active", true),
    supabase.from("treatment_combos").select("treatment_id").eq("is_active", true),
    supabase.from("bookings").select("treatment_id").in("status", [...OCCUPYING_BOOKING_STATUSES]).gte("starts_at", now),
  ]);

  const essentialResults = [
    ["categories", categoriesResult],
    ["specialties", specialtiesResult],
    ["professionals", professionalsResult],
    ["treatments", treatmentsResult],
    ["assignments", assignmentsResult],
    ["combos", combosResult],
  ] as const;
  const essentialIncidents = essentialResults.flatMap(([stage, result]) =>
    result.error ? [reportCatalogQueryFailure(correlationId, stage, result.error)] : [],
  );
  const bookingsIncident = bookingsResult.error
    ? reportCatalogQueryFailure(correlationId, "future-bookings", bookingsResult.error)
    : null;

  const shell = (
    <>
      <header className="live-admin__header"><div><h1>Catálogo</h1><p>Creá, editá y publicá las propuestas de Piel Canela.</p></div><div className="live-admin__actions"><Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form></div></header>
      <AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} />
    </>
  );

  if (essentialIncidents.length > 0) {
    return (
      <div className="live-admin site-container">
        {shell}
        <AdminInlineDataError
          title="No pudimos cargar los tratamientos"
          description="La navegación y tu sesión siguen disponibles. Reintentá la consulta; no se modificó ningún dato del catálogo."
          incidentId={essentialIncidents[0]!.incidentId}
        />
      </div>
    );
  }

  const futureCounts = new Map<string, number>();
  if (!bookingsResult.error) {
    for (const booking of bookingsResult.data ?? []) futureCounts.set(booking.treatment_id, (futureCounts.get(booking.treatment_id) ?? 0) + 1);
  }
  const professionalsByTreatment = new Map<string, string[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const current = professionalsByTreatment.get(assignment.treatment_id) ?? [];
    current.push(assignment.professional_id);
    professionalsByTreatment.set(assignment.treatment_id, current);
  }
  const treatmentsWithActiveCombo = new Set((combosResult.data ?? []).map((combo) => combo.treatment_id));
  const treatments = (treatmentsResult.data ?? []).map((item) => ({
    ...item,
    professional_ids: professionalsByTreatment.get(item.id) ?? (item.professional_id ? [item.professional_id] : []),
    has_active_combo: treatmentsWithActiveCombo.has(item.id),
    image_url: item.image_path ? (item.image_path.startsWith("/") || item.image_path.startsWith("https://") ? item.image_path : supabase.storage.from("treatment-media").getPublicUrl(item.image_path).data.publicUrl) : null,
    future_booking_count: futureCounts.get(item.id) ?? 0,
  }));
  return (
    <div className="live-admin site-container">
      {shell}
      <CatalogAdmin
        categories={categoriesResult.data ?? []}
        specialties={specialtiesResult.data ?? []}
        professionals={professionalsResult.data ?? []}
        treatments={treatments}
        feedback={await searchParams}
        bookingCountsAvailable={!bookingsResult.error}
        bookingCountsIncidentId={bookingsIncident?.incidentId}
      />
    </div>
  );
}
