import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { CatalogAdmin } from "@/components/admin/CatalogAdmin";
import { OCCUPYING_BOOKING_STATUSES } from "@/lib/admin/catalog";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Catálogo administrativo",
  description: "Gestión de tratamientos y categorías de Piel Canela.",
};

export default async function AdminCatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const now = new Date().toISOString();
  const [categoriesResult, specialtiesResult, professionalsResult, treatmentsResult, bookingsResult] = await Promise.all([
    supabase.from("treatment_categories").select("id,name,slug,short_description,icon_name,display_order,is_active").order("display_order"),
    supabase.from("specialties").select("id,name,is_active").order("display_order"),
    supabase.from("professionals").select("id,specialty_id,full_name,public_name,is_active").order("display_order"),
    supabase.from("treatments").select("id,category_id,specialty_id,professional_id,name,slug,short_description,description,expectations,characteristics,duration_minutes,buffer_minutes,price_cents,preparation,contraindications,image_path,image_alt,image_focal_x,image_focal_y,is_active,display_order").order("display_order").order("name"),
    supabase.from("bookings").select("treatment_id").in("status", [...OCCUPYING_BOOKING_STATUSES]).gte("starts_at", now),
  ]);
  const firstError = categoriesResult.error ?? specialtiesResult.error ?? professionalsResult.error ?? treatmentsResult.error ?? bookingsResult.error;
  if (firstError) throw new Error(`No se pudo cargar el catálogo administrativo: ${firstError.message}`);
  const futureCounts = new Map<string, number>();
  for (const booking of bookingsResult.data ?? []) futureCounts.set(booking.treatment_id, (futureCounts.get(booking.treatment_id) ?? 0) + 1);
  const treatments = (treatmentsResult.data ?? []).map((item) => ({
    ...item,
    image_url: item.image_path ? (item.image_path.startsWith("/") || item.image_path.startsWith("https://") ? item.image_path : supabase.storage.from("treatment-media").getPublicUrl(item.image_path).data.publicUrl) : null,
    future_booking_count: futureCounts.get(item.id) ?? 0,
  }));
  return (
    <div className="live-admin site-container">
      <header className="live-admin__header"><div><p className="eyebrow">Catálogo administrativo</p><h1>Tratamientos listos para informar y reservar.</h1><p>{profile.full_name}, acá controlás el contenido comercial sin perder las reglas operativas de agenda.</p></div><div className="live-admin__actions"><Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form></div></header>
      <AdminRouteNav current="catalog" />
      <CatalogAdmin categories={categoriesResult.data ?? []} specialties={specialtiesResult.data ?? []} professionals={professionalsResult.data ?? []} treatments={treatments} feedback={await searchParams} />
    </div>
  );
}
