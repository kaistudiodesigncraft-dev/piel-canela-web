import type { Metadata } from "next";
import { EditableSectionMedia, editableSurfaceClassName } from "@/components/content/EditableSectionMedia";
import { LiveBookingFlow } from "@/components/booking/LiveBookingFlow";
import { StatePanel } from "@/components/ui/StatePanel";
import { siteContentMap } from "@/domain/site-content";
import { buildBookingDates } from "@/lib/booking";
import {
  getPublicBookingSettings,
  getPublicCatalogSnapshot,
} from "@/lib/supabase/public-catalog";
import { getSiteContent } from "@/lib/supabase/site-content";
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
  const [query, catalog, settings, siteFields] = await Promise.all([
    searchParams,
    getPublicCatalogSnapshot(),
    getPublicBookingSettings(),
    getSiteContent(),
  ]);
  const content = siteContentMap(siteFields);
  const headerImage = content.get("booking_header_image");
  const treatment = catalog.treatments.find(
    (item) => item.id === query.treatmentId && item.isActive,
  );

  if (!treatment) {
    return (
      <>
        <BookingHeader content={content} image={headerImage} />
        <div className="site-container route-state">
          <StatePanel
            kind="empty"
            title="Primero elegí un tratamiento"
            description="Abrí el catálogo, revisá la información y seleccioná la opción que quieras reservar."
            actionHref="/tratamientos"
            actionLabel="Explorar tratamientos"
          />
        </div>
      </>
    );
  }

  const monthlySpecial = getMonthlySpecialForTreatment(
    catalog.monthlySpecials,
    query.monthlySpecialId,
    treatment.id,
  );

  return (
    <>
      <BookingHeader content={content} image={headerImage} />
      <div className="site-container booking-demo-page">
        <LiveBookingFlow
          selection={resolveBookingSelection(treatment, monthlySpecial)}
          dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)}
          whatsappNumber={settings.whatsappNumber}
        />
      </div>
    </>
  );
}

function BookingHeader({
  content,
  image,
}: {
  content: ReturnType<typeof siteContentMap>;
  image: ReturnType<ReturnType<typeof siteContentMap>["get"]>;
}) {
  return (
    <section className={editableSurfaceClassName("page-hero page-hero--booking", image)}>
      <EditableSectionMedia field={image} priority />
      <div className="site-container page-hero__content">
        <p className="eyebrow">{content.get("booking_header_eyebrow")?.value}</p>
        <h1>{content.get("booking_header_title")?.value}</h1>
        <p>{content.get("booking_header_lead")?.value}</p>
      </div>
    </section>
  );
}
