"use client";

import { AdminRouteError } from "@/components/admin/AdminRouteState";

export default function CustomersError({ reset }: { error: Error; reset: () => void }) {
  return <AdminRouteError title="los clientes" reset={reset} />;
}
