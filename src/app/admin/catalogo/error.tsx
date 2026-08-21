"use client";

import { AdminRouteError } from "@/components/admin/AdminRouteState";

export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminRouteError reset={reset} title="el catálogo" />;
}

