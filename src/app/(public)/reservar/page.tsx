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
import { getTreatmentMessageTemplates } from "@/lib/whatsapp/server";
import {
  getMonthlySpecialForTreatment,
  getTreatmentCombo,
  resolveBookingSelection,
} from "@/lib/treatments";

export const metadata: Metadata = {
  title: "Reservar",
  description: "Generá una pre-reserva de un tratamiento en Piel Canela.",
};

export const dynamic = "force-dynamic";

interface BookingPageProps {
  searchParams: Promise<{ treatmentId?: string; monthlySpecialId?: string; comboId?: string }>;
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
  const combo = getTreatmentCombo(treatment, query.comboId);
  const messageTemplates = catalog.source === "supabase" ? await getTreatmentMessageTemplates(treatment.id) : {};

  if (treatment.selectionMode === "closed_combo" && !combo) {
    return <><BookingHeader content={content} image={headerImage} /><div className="site-container route-state"><StatePanel kind="empty" title="Elegí un combo antes de reservar" description="La duración, el precio y la cantidad de sesiones dependen de la opción elegida." actionHref={`/tratamientos/${treatment.slug}`} actionLabel="Ver combos" /></div></>;
  }

  return (
    <>
      <BookingHeader content={content} image={headerImage} />
      <div className="site-container booking-demo-page">
        <LiveBookingFlow
          selection={resolveBookingSelection(treatment, treatment.selectionMode === "simple" ? monthlySpecial : undefined, combo)}
          dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)}
          whatsappNumber={settings.whatsappNumber}
          messageTemplates={messageTemplates}
          address={settings.address ?? ""}
          depositText={settings.depositText ?? ""}
          whatsappAutomationEnabled={process.env.WHATSAPP_AUTOMATION_ENABLED === "true"}
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
