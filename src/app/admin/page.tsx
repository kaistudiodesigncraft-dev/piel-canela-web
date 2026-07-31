import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageClient } from "@/components/admin/AdminPageClient";

export const metadata: Metadata = {
  title: "Panel administrativo demo",
  description: "Demostración operativa de agenda y reservas de Piel Canela.",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="catalog-skeleton" aria-label="Cargando panel" />}>
      <AdminPageClient />
    </Suspense>
  );
}
