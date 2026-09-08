import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { PackagesAdmin } from "@/components/admin/PackagesAdmin";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Paquetes de sesiones" };

export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const [packagesResult, bookingsResult, redemptionsResult] = await Promise.all([
    supabase.from("customer_packages").select("id,combo_name_snapshot,total_sessions,fixed_price_snapshot_cents,activated_at,expires_at,status,customer:customers(full_name,phone)").order("created_at", { ascending: false }),
    supabase.from("bookings").select("id,customer_package_id,booking_code,starts_at,status").not("customer_package_id", "is", null).order("starts_at"),
    supabase.from("package_redemptions").select("booking_id,consumed_at,restored_at"),
  ]);
  const error = packagesResult.error ?? bookingsResult.error ?? redemptionsResult.error;
  if (error) throw new Error(`No se pudieron cargar los paquetes: ${error.code ?? "query"}`);
  const redemptionByBooking = new Map((redemptionsResult.data ?? []).map((row) => [row.booking_id, row]));
  const bookingsByPackage = new Map<string, { id: string; booking_code: string; starts_at: string; status: string; consumed: boolean; restored: boolean }[]>();
  for (const booking of bookingsResult.data ?? []) {
    if (!booking.customer_package_id) continue;
    const redemption = redemptionByBooking.get(booking.id);
    const rows = bookingsByPackage.get(booking.customer_package_id) ?? [];
    rows.push({ ...booking, consumed: Boolean(redemption?.consumed_at), restored: Boolean(redemption?.restored_at) });
    bookingsByPackage.set(booking.customer_package_id, rows);
  }
  const packages = (packagesResult.data ?? []).map((item) => ({ ...item, customer: Array.isArray(item.customer) ? item.customer[0] ?? null : item.customer, bookings: bookingsByPackage.get(item.id) ?? [] }));
  return <div className="live-admin site-container"><header className="live-admin__header"><div><p className="eyebrow">Seguimiento operativo</p><h1>Paquetes y sesiones incluidas.</h1><p>{profile.full_name}, acá asignás próximas visitas, registrás consumos y controlás vencimientos.</p></div><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" />Cerrar sesión</button></form></header><AdminRouteNav current="packages" canManageAccess={profile.role === "admin"} /><PackagesAdmin packages={packages} feedback={await searchParams} referenceTime={new Date().toISOString()} /></div>;
}
