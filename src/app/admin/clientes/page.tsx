import type { Metadata } from "next";
import { ExternalLink, LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAdmin } from "@/app/admin/actions";
import { AdminRouteNav } from "@/components/admin/AdminRouteNav";
import { CustomersAdmin, type CustomerAdminBooking, type CustomerAdminRow } from "@/components/admin/CustomersAdmin";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Clientes",
  description: "Directorio e historial de clientes de Piel Canela.",
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { supabase, profile } = await requireAdmin();
  const referenceTime = new Date().toISOString();
  const [customersResult, bookingsResult] = await Promise.all([
    supabase.from("customers")
      .select("id,full_name,phone,email,internal_notes,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase.from("bookings")
      .select("id,customer_id,booking_code,status,starts_at,applied_price_snapshot_cents,treatment_name_snapshot")
      .order("starts_at", { ascending: false })
      .limit(1000),
  ]);
  const firstError = customersResult.error ?? bookingsResult.error;
  if (firstError) throw new Error(`No se pudo cargar el directorio: ${firstError.message}`);

  const bookingsByCustomer = new Map<string, CustomerAdminBooking[]>();
  for (const booking of bookingsResult.data ?? []) {
    const current = bookingsByCustomer.get(booking.customer_id) ?? [];
    current.push(booking as CustomerAdminBooking);
    bookingsByCustomer.set(booking.customer_id, current);
  }
  const customers: CustomerAdminRow[] = (customersResult.data ?? []).map((customer) => ({
    ...customer,
    bookings: bookingsByCustomer.get(customer.id) ?? [],
  }));

  return (
    <div className="live-admin site-container">
      <header className="live-admin__header">
        <div>
          <p className="eyebrow">Relación con clientes</p>
          <h1>Historial claro para atender con contexto.</h1>
          <p>{profile.full_name}, este directorio reúne datos de contacto y reservas sin convertir el producto en una historia clínica.</p>
        </div>
        <div className="live-admin__actions">
          <Link className="button button--quiet" href="/tratamientos" target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" strokeWidth={1.75} />Ver catálogo</Link>
          <form action={signOutAdmin}><button className="button button--quiet" type="submit"><LogOut aria-hidden="true" strokeWidth={1.75} />Cerrar sesión</button></form>
        </div>
      </header>
      <AdminRouteNav current="customers" />
      <CustomersAdmin customers={customers} referenceTime={referenceTime} feedback={await searchParams} />
    </div>
  );
}
