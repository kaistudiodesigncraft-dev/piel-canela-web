"use client";

import { useSearchParams } from "next/navigation";
import { DemoBookingFlow } from "@/components/booking/DemoBookingFlow";
import { StatePanel } from "@/components/ui/StatePanel";
import { monthlySpecials, treatments } from "@/data/fixtures";
import { getMonthlySpecialForTreatment, resolveBookingSelection } from "@/lib/treatments";

export function BookingPageClient() {
  const searchParams = useSearchParams();
  const treatment = treatments.find(
    (item) => item.id === searchParams.get("treatmentId") && item.isActive,
  );

  if (!treatment) {
    return (
      <div className="site-container route-state">
        <StatePanel
          kind="empty"
          title="Primero elegí un tratamiento"
          description="Abrí el catálogo, revisá la información y seleccioná la opción que quieras reservar."
          actionHref="/tratamientos"
          actionLabel="Explorar tratamientos"
        />
      </div>
    );
  }

  const monthlySpecial = getMonthlySpecialForTreatment(
    monthlySpecials,
    searchParams.get("monthlySpecialId"),
    treatment.id,
  );

  return (
    <div className="site-container booking-demo-page">
      <DemoBookingFlow selection={resolveBookingSelection(treatment, monthlySpecial)} />
    </div>
  );
}
