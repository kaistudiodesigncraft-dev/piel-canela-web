import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { PackagesAdmin } from "@/components/admin/PackagesAdmin";
import {
  UniversalPackagesAdmin,
  type UniversalPackageBookingCandidate,
  type UniversalPackageRow,
  type UniversalPackageSessionRow,
} from "@/components/admin/UniversalPackagesAdmin";
import { ServicePackageRulesSchema } from "@/lib/booking-config";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = { title: "Paquetes de sesiones" };

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const [packagesResult, bookingsResult, redemptionsResult, universalResult, universalSessionsResult, candidatesResult] = await Promise.all([
    supabase.from("customer_packages").select("id,combo_name_snapshot,total_sessions,fixed_price_snapshot_cents,activated_at,expires_at,status,customer:customers(full_name,phone)").order("created_at", { ascending: false }),
    supabase.from("bookings").select("id,customer_package_id,booking_code,starts_at,status").not("customer_package_id", "is", null).order("starts_at"),
    supabase.from("package_redemptions").select("booking_id,consumed_at,restored_at"),
    supabase.from("service_package_contracts").select("id,offering_name_snapshot,total_sessions,price_total_snapshot_cents,price_per_session_snapshot_cents,validity_until,payment_status,status,rules_snapshot,customer:customers!service_package_contracts_customer_id_fkey(full_name,phone),treatment:treatments!service_package_contracts_treatment_id_fkey(name)").order("created_at", { ascending: false }),
    supabase.from("service_package_sessions").select("id,package_id,booking_id,session_number,status,suggested_outcome,decision_is_exception,decision_reason,reschedule_count_snapshot,booking:bookings!service_package_sessions_booking_id_fkey(booking_code,starts_at,status,professional:professionals!bookings_professional_id_fkey(public_name,full_name))").order("session_number"),
    supabase.from("bookings").select("id,booking_code,starts_at,status,customer:customers(full_name,phone),treatment:treatments(name),offering:treatment_option_combos!inner(name,kind,session_count)").is("service_package_id", null).in("status", ["pending", "awaiting_deposit", "confirmed"]).eq("offering.kind", "package").order("starts_at"),
  ]);
  const error = packagesResult.error ?? bookingsResult.error ?? redemptionsResult.error
    ?? universalResult.error ?? universalSessionsResult.error ?? candidatesResult.error;
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
  const sessionsByPackage = new Map<string, UniversalPackageSessionRow[]>();
  for (const raw of universalSessionsResult.data ?? []) {
    const bookingValue = one(raw.booking);
    const professionalValue = bookingValue ? one(bookingValue.professional) : null;
    const session: UniversalPackageSessionRow = {
      id: raw.id,
      booking_id: raw.booking_id,
      session_number: raw.session_number,
      status: raw.status as UniversalPackageSessionRow["status"],
      suggested_outcome: raw.suggested_outcome as UniversalPackageSessionRow["suggested_outcome"],
      decision_is_exception: raw.decision_is_exception,
      decision_reason: raw.decision_reason,
      reschedule_count_snapshot: raw.reschedule_count_snapshot,
      booking: bookingValue ? {
        booking_code: bookingValue.booking_code,
        starts_at: bookingValue.starts_at,
        status: bookingValue.status,
        professional: professionalValue,
      } : null,
    };
    sessionsByPackage.set(raw.package_id, [...(sessionsByPackage.get(raw.package_id) ?? []), session]);
  }
  const universalPackages: UniversalPackageRow[] = (universalResult.data ?? []).map((raw) => {
    const rules = ServicePackageRulesSchema.safeParse(raw.rules_snapshot);
    if (!rules.success) throw new Error("No se pudieron validar las reglas congeladas de un paquete.");
    return {
      id: raw.id,
      offering_name_snapshot: raw.offering_name_snapshot,
      total_sessions: raw.total_sessions,
      price_total_snapshot_cents: raw.price_total_snapshot_cents,
      price_per_session_snapshot_cents: raw.price_per_session_snapshot_cents,
      validity_until: raw.validity_until,
      payment_status: raw.payment_status as UniversalPackageRow["payment_status"],
      status: raw.status as UniversalPackageRow["status"],
      rules_snapshot: rules.data,
      customer: one(raw.customer),
      treatment: one(raw.treatment),
      sessions: sessionsByPackage.get(raw.id) ?? [],
    };
  });
  const candidates: UniversalPackageBookingCandidate[] = (candidatesResult.data ?? []).map((raw) => ({
    id: raw.id,
    booking_code: raw.booking_code,
    starts_at: raw.starts_at,
    status: raw.status,
    customer: one(raw.customer),
    treatment: one(raw.treatment),
    offering: one(raw.offering),
  }));
  const feedback = await searchParams;
  const referenceTime = new Date().toISOString();
  return <div className="live-admin site-container"><header className="live-admin__header"><div><p className="eyebrow">Seguimiento operativo</p><h1>Paquetes y sesiones incluidas.</h1><p>{profile.full_name}, acá asignás próximas visitas, registrás consumos y controlás vencimientos.</p></div><form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" />Cerrar sesión</button></form></header><AdminRouteNav current="packages" canManageAccess={profile.role === "admin"} /><UniversalPackagesAdmin packages={universalPackages} candidates={candidates} feedback={feedback} referenceTime={referenceTime} /><PackagesAdmin packages={packages} feedback={feedback} referenceTime={referenceTime} /></div>;
}
