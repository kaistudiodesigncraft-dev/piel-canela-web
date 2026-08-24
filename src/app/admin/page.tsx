import type { Metadata } from "next";
import { LiveAdminDashboard } from "@/components/admin/LiveAdminDashboard";
import {
  ADMIN_AGENDA_PAGE_SIZE,
  adminAgendaPageRange,
  getAdminAgendaRange,
  parseAdminAgendaQuery,
} from "@/lib/admin/agenda";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Panel administrativo",
  description: "Agenda y configuración operativa de Piel Canela.",
};

interface AdminPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const bookingSelect = "id,booking_code,status,starts_at,ends_at,duration_snapshot_minutes,applied_price_snapshot_cents,customer_notes,internal_notes,created_at,rescheduled_at,reschedule_count,status_reason,status_changed_at,deposit_confirmed_at,completed_at,no_show_at,customer:customers(full_name,phone,email),treatment:treatments(name)";

interface BookingHistoryRow {
  id: number;
  booking_id: string;
  previous_status: "pending" | "awaiting_deposit" | "confirmed" | "cancelled" | "completed" | "no_show" | "expired" | null;
  next_status: "pending" | "awaiting_deposit" | "confirmed" | "cancelled" | "completed" | "no_show" | "expired";
  reason: string | null;
  created_at: string;
  actor: { full_name: string }[] | { full_name: string } | null;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { supabase, profile } = await requireAdmin();
  const query = await searchParams;
  const now = new Date();
  const nowIso = now.toISOString();
  const agendaQuery = parseAdminAgendaQuery(query, now);
  const agendaRange = getAdminAgendaRange(agendaQuery);
  const { from, to } = adminAgendaPageRange(agendaQuery.page);
  const todayRange = getAdminAgendaRange({
    ...agendaQuery,
    view: "day",
    date: parseAdminAgendaQuery({}, now).date,
    page: 1,
  });

  let bookingsRequest = supabase.from("bookings")
    .select(bookingSelect, { count: "exact" });
  if (agendaRange.startsAt && agendaRange.endsAt) {
    bookingsRequest = bookingsRequest
      .gte("starts_at", agendaRange.startsAt)
      .lt("starts_at", agendaRange.endsAt);
  }
  if (agendaQuery.status !== "all") {
    bookingsRequest = bookingsRequest.eq("status", agendaQuery.status);
  }
  bookingsRequest = bookingsRequest
    .order("starts_at", { ascending: agendaQuery.view !== "all" })
    .range(from, to);

  const [
    specialtiesResult,
    rulesResult,
    exceptionsResult,
    treatmentsResult,
    specialsResult,
    bookingsResult,
    todayCountResult,
    attentionCountResult,
    confirmedCountResult,
  ] = await Promise.all([
    supabase.from("specialties").select("id,name,slug,description,display_order,is_active").order("display_order"),
    supabase.from("availability_rules").select("id,specialty_id,weekday,start_time,end_time").eq("is_active", true).order("weekday").order("start_time"),
    supabase.from("availability_exceptions").select("id,specialty_id,kind,starts_at,ends_at,public_reason,internal_reason").gte("ends_at", nowIso).order("starts_at").limit(40),
    supabase.from("treatments").select("id,name,specialty_id,duration_minutes,buffer_minutes,start_interval_minutes,price_cents,is_active").eq("is_active", true).order("name"),
    supabase.from("monthly_specials").select("id,treatment_id,title,short_description,detail,image_path,image_alt,special_price_cents,reference_price_cents,starts_at,ends_at,terms,is_active,display_order").order("display_order"),
    bookingsRequest,
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .gte("starts_at", todayRange.startsAt as string)
      .lt("starts_at", todayRange.endsAt as string),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .in("status", ["pending", "awaiting_deposit"]),
    supabase.from("bookings").select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("starts_at", nowIso),
  ]);

  const firstError = specialtiesResult.error
    ?? rulesResult.error
    ?? exceptionsResult.error
    ?? treatmentsResult.error
    ?? specialsResult.error
    ?? bookingsResult.error
    ?? todayCountResult.error
    ?? attentionCountResult.error
    ?? confirmedCountResult.error;
  if (firstError) throw new Error(`No se pudo cargar la operación: ${firstError.message}`);

  const bookingRows = bookingsResult.data ?? [];
  const bookingIds = bookingRows.map((booking) => booking.id);
  let bookingHistoryRows: BookingHistoryRow[] = [];
  if (bookingIds.length > 0) {
    const bookingHistoryResult = await supabase.from("booking_status_history")
      .select("id,booking_id,previous_status,next_status,reason,created_at,actor:profiles(full_name)")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: false });
    if (bookingHistoryResult.error) {
      throw new Error(`No se pudo cargar el historial de reservas: ${bookingHistoryResult.error.message}`);
    }
    bookingHistoryRows = (bookingHistoryResult.data ?? []) as BookingHistoryRow[];
  }

  const historyByBooking = new Map<string, BookingHistoryRow[]>();
  for (const history of bookingHistoryRows) {
    const current = historyByBooking.get(history.booking_id) ?? [];
    current.push(history);
    historyByBooking.set(history.booking_id, current);
  }
  const bookings = bookingRows.map((booking) => ({
    ...booking,
    customer: Array.isArray(booking.customer) ? (booking.customer[0] ?? null) : booking.customer,
    treatment: Array.isArray(booking.treatment) ? (booking.treatment[0] ?? null) : booking.treatment,
    history: (historyByBooking.get(booking.id) ?? []).map((history) => ({
      ...history,
      actor: Array.isArray(history.actor) ? (history.actor[0] ?? null) : history.actor,
    })),
  }));
  const specials = (specialsResult.data ?? []).map((special) => ({
    ...special,
    image_url: special.image_path.startsWith("/") || special.image_path.startsWith("https://")
      ? special.image_path
      : supabase.storage.from("treatment-media").getPublicUrl(special.image_path).data.publicUrl,
  }));

  return (
    <LiveAdminDashboard
      adminName={profile.full_name}
      canManageAccess={profile.role === "admin"}
      referenceTime={nowIso}
      specialties={specialtiesResult.data ?? []}
      rules={rulesResult.data ?? []}
      exceptions={exceptionsResult.data ?? []}
      treatments={treatmentsResult.data ?? []}
      monthlySpecials={specials}
      bookings={bookings}
      agenda={{
        query: agendaQuery,
        range: agendaRange,
        total: bookingsResult.count ?? 0,
        pageSize: ADMIN_AGENDA_PAGE_SIZE,
        summary: {
          today: todayCountResult.count ?? 0,
          attention: attentionCountResult.count ?? 0,
          confirmed: confirmedCountResult.count ?? 0,
        },
      }}
      feedback={query}
    />
  );
}
