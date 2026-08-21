import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { BusinessSettingsAdmin, type BusinessSettingsRow } from "@/components/admin/BusinessSettingsAdmin";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Configuración",
  description: "Configuración comercial y reglas del turnero de Piel Canela.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const { data, error } = await supabase.from("business_settings")
    .select("singleton,business_name,timezone,minimum_notice_minutes,maximum_advance_days,pending_expiry_minutes,whatsapp_number,address,public_email,instagram_url,deposit_text,cancellation_policy,updated_at")
    .eq("singleton", true)
    .single();
  if (error || !data) throw new Error(`No se pudo cargar la configuración: ${error?.message ?? "missing_settings"}`);
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div><p className="eyebrow">Reglas del negocio</p><h1>Datos públicos y condiciones operativas.</h1><p>{profile.full_name}, estos ajustes gobiernan el calendario, el cierre por WhatsApp y la información de contacto.</p></div>
        <div className="live-admin__actions"><Link className="button button--quiet" href="/" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver sitio</Link><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form></div>
      </header>
      <AdminRouteNav current="settings" />
      <BusinessSettingsAdmin settings={data as BusinessSettingsRow} feedback={await searchParams} />
    </div>
  );
}
