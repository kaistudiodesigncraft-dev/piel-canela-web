"use client";

import { useEffect, useState } from "react";
import type { MonthlySpecial, Treatment, TreatmentCategory } from "@/domain/treatment";
import type { SiteContentField, SiteContentSection } from "@/domain/site-content";
import { PublicSiteContentSection } from "@/components/content/PublicSiteContentSection";

interface PreviewMessage {
  type: "piel-canela-content-preview";
  section: SiteContentSection;
  fields: readonly SiteContentField[];
}

const allowedSections = new Set<SiteContentSection>(["hero", "categories", "specials", "approach", "booking", "faq", "catalog_header", "booking_header"]);

export function ContentPreviewReceiver({
  initialSection,
  initialFields,
  categories,
  treatments,
  monthlySpecials,
}: {
  initialSection: SiteContentSection;
  initialFields: readonly SiteContentField[];
  categories: readonly TreatmentCategory[];
  treatments: readonly Treatment[];
  monthlySpecials: readonly MonthlySpecial[];
}) {
  const [section, setSection] = useState(initialSection);
  const [fields, setFields] = useState(initialFields);

  useEffect(() => {
    const announceHeight = () => window.parent.postMessage({ type: "piel-canela-content-preview-height", height: document.documentElement.scrollHeight }, window.location.origin);
    const observer = new ResizeObserver(announceHeight);
    observer.observe(document.body);
    const receive = (event: MessageEvent<PreviewMessage>) => {
      if (event.origin !== window.location.origin || event.data?.type !== "piel-canela-content-preview" || !allowedSections.has(event.data.section) || !Array.isArray(event.data.fields)) return;
      setSection(event.data.section);
      setFields(event.data.fields);
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "piel-canela-content-preview-ready" }, window.location.origin);
    return () => { observer.disconnect(); window.removeEventListener("message", receive); };
  }, []);

  return <div className="public-site content-preview-document">
    <PublicSiteContentSection section={section} fields={fields} categories={categories} treatments={treatments} monthlySpecials={monthlySpecials} />
  </div>;
}
