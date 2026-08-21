"use client";

import { AdminRouteError } from "@/components/admin/AdminRouteState";

export default function SettingsError({ reset }: { error: Error; reset: () => void }) {
  return <AdminRouteError title="la configuración" reset={reset} />;
}
