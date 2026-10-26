import { describe, expect, it } from "vitest";
import { buildAdminHealthNotices, findDuplicateProfessionalNames } from "./catalog-health";

describe("catalog health", () => {
  it("detects active duplicate identities without merging them", () => {
    expect(findDuplicateProfessionalNames([
      { full_name: "Agustina Spertino", public_name: null, is_active: true },
      { full_name: "Agustina  Spértino", public_name: null, is_active: true },
      { full_name: "Agustina Spertino", public_name: null, is_active: false },
    ])).toEqual(["Agustina Spertino"]);
  });

  it("warns only about active specialties used by treatments and lacking weekly rules", () => {
    const notices = buildAdminHealthNotices({
      specialties: [
        { id: "massage", name: "Masoterapia", is_active: true },
        { id: "facial", name: "Estética facial", is_active: true },
        { id: "inactive", name: "Inactiva", is_active: false },
      ],
      rules: [{ specialty_id: "facial" }],
      treatments: [
        { specialty_id: "massage", is_active: true },
        { specialty_id: "facial", is_active: true },
        { specialty_id: "inactive", is_active: true },
      ],
      professionals: [],
    });

    expect(notices).toEqual([expect.objectContaining({ id: "missing-availability", description: expect.stringContaining("Masoterapia") })]);
  });
});
