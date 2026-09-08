import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { DepilationComboAdmin } from "@/components/admin/DepilationComboAdmin";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Combos de depilación" };

export default async function TreatmentCombosPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const { supabase, profile } = await requireAdmin();
  const [treatmentResult, zonesResult, combosResult, linksResult, bookingsResult, packagesResult, settingsResult] = await Promise.all([
    supabase.from("treatments").select("id,name,slug,selection_mode,buffer_minutes,start_interval_minutes").eq("id", id).maybeSingle(),
    supabase.from("depilation_zones").select("id,name,audience,reference_price_cents,duration_minutes,is_active,display_order").order("display_order").order("name"),
    supabase.from("treatment_combos").select("id,name,description,audience,mode,session_count,fixed_price_cents,validity_days,is_active,display_order").eq("treatment_id", id).order("display_order").order("name"),
    supabase.from("treatment_combo_zones").select("combo_id,zone_id,display_order").order("display_order"),
    supabase.from("bookings").select("treatment_combo_id").eq("treatment_id", id).not("treatment_combo_id", "is", null),
    supabase.from("customer_packages").select("combo_id").eq("treatment_id", id),
    supabase.from("business_settings").select("depilation_combos_enabled").eq("singleton", true).maybeSingle(),
  ]);
  if (!treatmentResult.data) notFound();
  const error = zonesResult.error ?? combosResult.error ?? linksResult.error ?? bookingsResult.error ?? packagesResult.error ?? settingsResult.error;
  if (error) throw new Error(`No se pudo cargar la configuración de combos: ${error.code ?? "query"}`);
  if (treatmentResult.data.selection_mode !== "closed_combo") notFound();
  const linksByCombo = new Map<string, string[]>();
  const linkCountsByZone = new Map<string, number>();
  for (const link of linksResult.data ?? []) {
    linksByCombo.set(link.combo_id, [...(linksByCombo.get(link.combo_id) ?? []), link.zone_id]);
    linkCountsByZone.set(link.zone_id, (linkCountsByZone.get(link.zone_id) ?? 0) + 1);
  }
  const bookingCounts = new Map<string, number>();
  for (const row of bookingsResult.data ?? []) if (row.treatment_combo_id) bookingCounts.set(row.treatment_combo_id, (bookingCounts.get(row.treatment_combo_id) ?? 0) + 1);
  const packageCounts = new Map<string, number>();
  for (const row of packagesResult.data ?? []) packageCounts.set(row.combo_id, (packageCounts.get(row.combo_id) ?? 0) + 1);
  const combos = (combosResult.data ?? []).map((combo) => ({ ...combo, zone_ids: linksByCombo.get(combo.id) ?? [], booking_count: bookingCounts.get(combo.id) ?? 0, package_count: packageCounts.get(combo.id) ?? 0 }));
  const zones = (zonesResult.data ?? []).map((zone) => ({ ...zone, link_count: linkCountsByZone.get(zone.id) ?? 0 }));
  return <div className="live-admin site-container"><header className="live-admin__header admin-editor-page-header"><div><Link className="admin-back-link" href={`/admin/catalogo/${id}`}><ArrowLeft aria-hidden="true" />Editar tratamiento</Link><p className="eyebrow">Configuración comercial</p><h1>Combos de {treatmentResult.data.name}</h1><p>Prepará opciones cerradas, paquetes y precios sin modificar las reservas históricas.</p></div><div className="live-admin__actions"><Link className="button button--quiet" href={`/admin/catalogo/${id}/preview`} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Vista previa</Link></div></header><AdminRouteNav current="catalog" canManageAccess={profile.role === "admin"} /><DepilationComboAdmin treatmentId={id} treatmentName={treatmentResult.data.name} treatmentBufferMinutes={treatmentResult.data.buffer_minutes} startIntervalMinutes={treatmentResult.data.start_interval_minutes} featureEnabled={settingsResult.data?.depilation_combos_enabled ?? false} zones={zones} combos={combos} feedback={await searchParams} /></div>;
}
