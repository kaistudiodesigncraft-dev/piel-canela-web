import { describe, expect, it } from "vitest";
import { auditChangedFields, auditEntityReference, auditSearchText, type AuditRecord } from "./audit";

const record: AuditRecord = {
  id: 1,
  actor_id: "10000000-0000-4000-8000-000000000001",
  table_name: "bookings",
  record_id: "20000000-0000-4000-8000-000000000001",
  action: "update",
  old_data: { booking_code: "PC-4821", status: "confirmed", internal_notes: "Anterior", updated_at: "a" },
  new_data: { booking_code: "PC-4821", status: "cancelled", internal_notes: "Nueva", updated_at: "b" },
  created_at: "2026-08-21T12:00:00.000Z",
};

describe("administrative audit helpers", () => {
  it("reports only meaningful changed fields and marks private content", () => {
    expect(auditChangedFields(record)).toEqual([
      { key: "status", label: "Estado", isPrivate: false },
      { key: "internal_notes", label: "Nota interna", isPrivate: true },
    ]);
  });

  it("builds a human reference and normalized search content", () => {
    expect(auditEntityReference(record)).toBe("PC-4821");
    expect(auditSearchText(record, "María Pérez")).toContain("reservas edicion pc-4821 maria perez");
  });
});
