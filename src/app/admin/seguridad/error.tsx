"use client";

import { AdminRouteError } from "@/components/admin/AdminRouteState";

export default function GovernanceError({ reset }: { error: Error; reset: () => void }) {
  return <AdminRouteError title="los accesos y la actividad" reset={reset} />;
}
