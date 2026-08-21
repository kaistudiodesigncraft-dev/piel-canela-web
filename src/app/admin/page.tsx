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
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  if (!usesSupabaseDataSource()) redirect("/admin/login?error=configuration");
  const supabase = await createSupabaseServerClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = authData?.claims?.sub;
  if (!userId) redirect("/admin/login");

  const now = new Date().toISOString();
  const [profileResult, specialtiesResult, rulesResult, exceptionsResult, treatmentsResult, specialsResult, bookingsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("user_id", userId).single(),
    supabase.from("specialties").select("id,name,slug,description,display_order,is_active").order("display_order"),
    supabase.from("availability_rules").select("id,specialty_id,weekday,start_time,end_time,slot_interval_minutes").eq("is_active", true).order("weekday").order("start_time"),
    supabase.from("availability_exceptions").select("id,specialty_id,kind,starts_at,ends_at,public_reason,internal_reason").gte("ends_at", now).order("starts_at").limit(40),
    supabase.from("treatments").select("id,name,specialty_id,duration_minutes,price_cents,is_active").eq("is_active", true).order("name"),
    supabase.from("monthly_specials").select("id,treatment_id,title,short_description,detail,image_path,image_alt,special_price_cents,reference_price_cents,starts_at,ends_at,terms,is_active,display_order").order("display_order"),
    supabase.from("bookings")
      .select("id,booking_code,status,starts_at,ends_at,duration_snapshot_minutes,applied_price_snapshot_cents,customer_notes,internal_notes,created_at,rescheduled_at,reschedule_count,customer:customers(full_name,phone,email),treatment:treatments(name)")
      .order("starts_at", { ascending: true }).limit(100),
  ]);

  if (profileResult.error || !profileResult.data) redirect("/admin/login?error=profile");
  const bookings = (bookingsResult.data ?? []).map((booking) => ({
    ...booking,
    customer: Array.isArray(booking.customer) ? (booking.customer[0] ?? null) : booking.customer,
    treatment: Array.isArray(booking.treatment) ? (booking.treatment[0] ?? null) : booking.treatment,
  }));
  const specials = (specialsResult.data ?? []).map((special) => ({
    ...special,
    image_url: special.image_path.startsWith("/") || special.image_path.startsWith("https://")
      ? special.image_path
      : supabase.storage.from("treatment-media").getPublicUrl(special.image_path).data.publicUrl,
  }));
  const query = await searchParams;

  return (
    <LiveAdminDashboard
      adminName={profileResult.data.full_name}
      referenceTime={now}
      specialties={specialtiesResult.data ?? []}
      rules={rulesResult.data ?? []}
      exceptions={exceptionsResult.data ?? []}
      treatments={treatmentsResult.data ?? []}
      monthlySpecials={specials}
      bookings={bookings}
      feedback={query}
    />
  );
}
