import "server-only";

import { randomUUID } from "node:crypto";

export type CatalogQueryStage =
  | "categories"
  | "specialties"
  | "professionals"
  | "treatments"
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
  return randomUUID();
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
    incidentId: randomUUID(),
    stage,
    code: error.code || "unknown",
  };

  console.error(JSON.stringify({
    event: "admin_catalog_query_failed",
    ...incident,
  }));

  return incident;
}
