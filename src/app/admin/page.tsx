import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LiveAdminDashboard } from "@/components/admin/LiveAdminDashboard";
import { usesSupabaseDataSource } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel administrativo",
  description: "Agenda y configuración operativa de Piel Canela.",
};

interface AdminPageProps {
  searchParams: Promise<{
    availabilitySaved?: string;
    availabilityError?: string;
    bookingSaved?: string;
    bookingError?: string;
  }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!usesSupabaseDataSource()) redirect("/admin/login?error=configuration");

  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/admin/login");

  const [profileResult, specialtiesResult, rulesResult, bookingsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", userId).single(),
    supabase.from("specialties").select("id,name").eq("is_active", true).order("display_order"),
    supabase.from("availability_rules").select("id,specialty_id,weekday,start_time,end_time,slot_interval_minutes").eq("is_active", true).order("weekday").order("start_time"),
    supabase
      .from("bookings")
      .select("id,booking_code,status,starts_at,duration_snapshot_minutes,applied_price_snapshot_cents,customer_notes,internal_notes,customer:customers(full_name,phone,email),treatment:treatments(name)")
      .order("starts_at", { ascending: true })
      .limit(50),
  ]);

  if (profileResult.error || !profileResult.data) redirect("/admin/login?error=profile");
  const bookings = (bookingsResult.data ?? []).map((booking) => ({
    ...booking,
    customer: Array.isArray(booking.customer) ? (booking.customer[0] ?? null) : booking.customer,
    treatment: Array.isArray(booking.treatment) ? (booking.treatment[0] ?? null) : booking.treatment,
  }));
  const query = await searchParams;

  return (
    <LiveAdminDashboard
      adminName={profileResult.data.full_name}
      specialties={specialtiesResult.data ?? []}
      rules={rulesResult.data ?? []}
      bookingCount={bookings.length}
      pendingCount={bookings.filter((item) => item.status === "pending" || item.status === "awaiting_deposit").length}
      confirmedCount={bookings.filter((item) => item.status === "confirmed").length}
      bookings={bookings}
      availabilitySaved={query.availabilitySaved === "1"}
      availabilityError={query.availabilityError}
      bookingSaved={query.bookingSaved === "1"}
      bookingError={query.bookingError}
    />
  );
}
