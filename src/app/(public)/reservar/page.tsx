import type { Metadata } from "next";
import { PublicSiteContentSection } from "@/components/content/PublicSiteContentSection";
import { LiveBookingFlow } from "@/components/booking/LiveBookingFlow";
import { StatePanel } from "@/components/ui/StatePanel";
import { buildBookingDates } from "@/lib/booking";
import { resolveZoneOrder } from "@/lib/depilation-selection";
import {
  getPublicBookingSettings,
  getPublicCatalogSnapshot,
} from "@/lib/supabase/public-catalog";
import { getSiteContent } from "@/lib/supabase/site-content";
import {
  getMonthlySpecialForTreatment,
  getTreatmentCombo,
  buildConfiguredTreatmentSelectionHref,
  buildTreatmentSelectionHref,
  resolveConfiguredBookingSelection,
  resolveBookingSelection,
} from "@/lib/treatments";

export const metadata: Metadata = {
  title: "Reservar",
  description: "Generá una pre-reserva de un tratamiento en Piel Canela.",
};

export const dynamic = "force-dynamic";

interface BookingPageProps {
  searchParams: Promise<{
    treatmentId?: string;
    monthlySpecialId?: string;
    comboId?: string;
    extraId?: string | string[];
    zoneId?: string | string[];
    zoneOrder?: string;
    bookingOrder?: string;
    combinationId?: string;
    optionId?: string | string[];
  }>;
}
export default async function BookingPage({ searchParams }: BookingPageProps) {
  const [query, catalog, settings, siteFields] = await Promise.all([
    searchParams,
    getPublicCatalogSnapshot(),
    getPublicBookingSettings(),
    getSiteContent(),
  ]);
  const treatment = catalog.treatments.find(
    (item) => item.id === query.treatmentId && item.isActive,
  );

  if (!treatment) {
    return (
      <>
        <PublicSiteContentSection section="booking_header" fields={siteFields} />
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

  if (treatment.configEnabled) {
    const optionIds = Array.isArray(query.optionId) ? query.optionId : query.optionId ? [query.optionId] : [];
    const hasLegacySelection = Boolean(
      query.monthlySpecialId || query.comboId || query.extraId || query.zoneId || query.zoneOrder,
    );
    let selection;
    try {
      if (query.bookingOrder !== "1" || hasLegacySelection) throw new Error("invalid_configured_selection");
      selection = resolveConfiguredBookingSelection(treatment, query.combinationId ?? null, optionIds);
    } catch {
      selection = null;
    }
    if (!selection) {
      return <div className="site-container route-state"><StatePanel
        kind="empty"
        title="Revisá tu elección"
        description="La propuesta cambió o ya no está disponible. Volvé al tratamiento para elegir entre las opciones publicadas."
        actionHref={`/tratamientos/${treatment.slug}#opciones`}
        actionLabel="Volver a las opciones"
      /></div>;
    }
    const selectionHref = treatment.bookingConfig?.mode === "simple"
      ? undefined
      : buildConfiguredTreatmentSelectionHref(treatment.slug, {
        combinationId: query.combinationId ?? null,
        optionIds,
      });
    return <><h1 className="sr-only">Reservar {treatment.name}</h1><div className="site-container booking-demo-page">
      <LiveBookingFlow
        selection={selection}
        selectionHref={selectionHref}
        dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)}
        whatsappNumber={settings.whatsappNumber}
      />
    </div></>;
  }

  if (query.bookingOrder || query.combinationId || query.optionId) {
    return <div className="site-container route-state"><StatePanel
      kind="error"
      title="Esta selección no corresponde al tratamiento"
      description="Volvé a la ficha para elegir una opción disponible."
      actionHref={`/tratamientos/${treatment.slug}`}
      actionLabel="Ver tratamiento"
    /></div>;
  }

  const monthlySpecial = getMonthlySpecialForTreatment(
    catalog.monthlySpecials,
    query.monthlySpecialId,
    treatment.id,
  );
  const combo = getTreatmentCombo(treatment, query.comboId);
  const requestedExtraIds = Array.isArray(query.extraId) ? query.extraId : query.extraId ? [query.extraId] : [];
  const selectedExtras = combo?.extras.filter((extra) => requestedExtraIds.includes(extra.id) && extra.isActive) ?? [];
  if (treatment.zoneOrder) {
    const zoneIds = Array.isArray(query.zoneId) ? query.zoneId : query.zoneId ? [query.zoneId] : [];
    let selection;
    try {
      if (query.monthlySpecialId) throw new Error("incompatible_selection");
      if (requestedExtraIds.length) {
        if (!combo || zoneIds.length || !combo.allowPublicExtras || selectedExtras.length !== requestedExtraIds.length) {
          throw new Error("incompatible_selection");
        }
        selection = resolveBookingSelection(treatment, undefined, combo, selectedExtras);
      } else {
        selection = resolveZoneOrder(treatment, query.comboId, zoneIds);
      }
    } catch {
      return <div className="site-container route-state"><StatePanel kind="empty"
        title="Revisá tus zonas o combo"
        description="Elegí al menos una zona o un combo disponible. Los extras solo pueden sumarse a los combos donde Piel Canela los habilitó."
        actionHref={`/tratamientos/${treatment.slug}`} actionLabel="Elegir zonas y combos" /></div>;
    }
    return <><h1 className="sr-only">Reservar {treatment.name}</h1><div className="site-container booking-demo-page">
      <LiveBookingFlow selection={selection} selectionHref={buildTreatmentSelectionHref(treatment.slug, selection)} dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)} whatsappNumber={settings.whatsappNumber} />
    </div></>;
  }
  if (query.zoneOrder || query.zoneId) {
    return <div className="site-container route-state"><StatePanel kind="error" title="Esta selección todavía no está habilitada"
      description="Volvé al tratamiento para consultar las opciones disponibles." actionHref={`/tratamientos/${treatment.slug}`} actionLabel="Ver opciones" /></div>;
  }
  if (treatment.selectionMode !== "simple" && !combo) {
    const hasPublicCombos = treatment.combos.some((item) => item.isActive);
    return <><PublicSiteContentSection section="booking_header" fields={siteFields} /><div className="site-container route-state"><StatePanel
      kind="empty"
      title={query.comboId ? "Este combo no está disponible para reservar" : "Elegí un combo antes de reservar"}
      description={hasPublicCombos
        ? "Elegí una de las opciones publicadas para consultar su precio y disponibilidad."
        : "Este tratamiento no tiene combos disponibles en este momento. Podés elegir otro tratamiento desde el catálogo."}
      actionHref={hasPublicCombos ? `/tratamientos/${treatment.slug}` : "/tratamientos"}
      actionLabel={hasPublicCombos ? "Elegir otro combo" : "Volver al catálogo"}
    /></div></>;
  }

  return (
    <>
      <h1 className="sr-only">Reservar {treatment.name}</h1>
      <div className="site-container booking-demo-page">
        <LiveBookingFlow
          selection={resolveBookingSelection(treatment, treatment.selectionMode === "simple" ? monthlySpecial : undefined, combo, selectedExtras)}
          selectionHref={combo ? buildTreatmentSelectionHref(treatment.slug, resolveBookingSelection(treatment, undefined, combo, selectedExtras)) : undefined}
          dates={buildBookingDates(new Date(), settings.maximumAdvanceDays + 1)}
          whatsappNumber={settings.whatsappNumber}
        />
      </div>
    </>
  );
}
