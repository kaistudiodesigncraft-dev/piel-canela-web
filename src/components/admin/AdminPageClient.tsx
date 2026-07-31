"use client";

import { useSearchParams } from "next/navigation";
import { DemoAdminDashboard } from "@/components/admin/DemoAdminDashboard";
import { demoBookings } from "@/data/demo-bookings";
import { monthlySpecials, treatments } from "@/data/fixtures";
import type { DemoBookingQuery } from "@/domain/treatment";
import { resolveDemoBookingFromQuery } from "@/lib/demo-bookings";

export function AdminPageClient() {
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries()) as DemoBookingQuery;
  const createdBooking = resolveDemoBookingFromQuery(query, treatments, monthlySpecials);

  return (
    <DemoAdminDashboard
      initialBookings={demoBookings}
      treatments={treatments}
      monthlySpecials={monthlySpecials}
      createdBooking={createdBooking}
    />
  );
}
