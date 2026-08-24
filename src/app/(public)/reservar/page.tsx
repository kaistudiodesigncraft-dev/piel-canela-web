import type { Metadata } from "next";
import { LiveBookingFlow } from "@/components/booking/LiveBookingFlow";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildBookingDates } from "@/lib/booking";
import {
  getPublicBookingSettings,
  getPublicCatalogSnapshot,
} from "@/lib/supabase/public-catalog";
import {
  getMonthlySpecialForTreatment,
  resolveBookingSelection,
} from "@/lib/treatments";

export const metadata: Metadata = {
  title: "Reservar",
  description: "Generá una pre-reserva de un tratamiento en Piel Canela.",
};

export const dynamic = "force-dynamic";

interface BookingPageProps {
  searchParams: Promise<{ treatmentId?: string; monthlySpecialId?: string }>;
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const [query, catalog, settings] = await Promise.all([
    searchParams,
    getPublicCatalogSnapshot(),
    getPublicBookingSettings(),
  ]);
  const treatment = catalog.treatments.find(
    (item) => item.id === query.treatmentId && item.isActive,
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
    catalog.monthlySpecials,
    query.monthlySpecialId,
    treatment.id,
  );

  return (
    <div className="site-container booking-demo-page">
      <LiveBookingFlow
        selection={resolveBookingSelection(treatment, monthlySpecial)}
        dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)}
        whatsappNumber={settings.whatsappNumber}
      />
    </div>
  );
}
