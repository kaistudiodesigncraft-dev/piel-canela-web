import "server-only";

import { createSupportCode, reportOperationalEvent } from "@/lib/observability";

export type CatalogQueryStage =
  | "categories"
  | "specialties"
  | "professionals"
  | "treatments"
  | "assignments"
  | "combos"
  | "availability"
  | "future-bookings";

interface CatalogQueryError {
  code?: string | null;
}

export interface CatalogIncident {
  correlationId: string;
  incidentId: string;
  stage: CatalogQueryStage;
  code: string;
}

export function createCatalogCorrelationId() {
  return createSupportCode();
}

/**
 * Records only operational metadata. Query messages, user identifiers and
 * submitted content are deliberately excluded because they may contain PII.
 */
export function reportCatalogQueryFailure(
  correlationId: string,
  stage: CatalogQueryStage,
  error: CatalogQueryError,
): CatalogIncident {
  const incident: CatalogIncident = {
    correlationId,
    incidentId: createSupportCode(),
    stage,
    code: error.code || "unknown",
  };

  reportOperationalEvent({ event: "admin_catalog_query_failed", stage, code: incident.code, supportCode: incident.incidentId });

  return incident;
}
