import { describe, expect, it } from "vitest";
import { parsePublicBusinessDetails, publicBusinessDetailsPatch } from "./public-business-details";

describe("agency public business details", () => {
  it("does not overwrite additional fields from an old or disabled form", () => {
    const form = new FormData();
    const parsed = parsePublicBusinessDetails(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(publicBusinessDetailsPatch(form, parsed.data)).toEqual({});
  });

  it("allows explicit clearing and updates only submitted fields", () => {
    const form = new FormData();
    form.set("receptionHours", " Lunes a viernes de 9 a 18 ");
    form.set("noShowPolicy", "");
    const parsed = parsePublicBusinessDetails(form);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(publicBusinessDetailsPatch(form, parsed.data)).toEqual({
      reception_hours: "Lunes a viernes de 9 a 18", no_show_policy: null,
    });
  });

  it.each([
    ["receptionHours", "x".repeat(501)],
    ["privacyResponsible", "x".repeat(201)],
    ["privacyContactEmail", "invalid-address"],
    ["noShowPolicy", "x".repeat(2001)],
    ["packagePolicy", "<script>alert(1)</script>"],
  ])("rejects invalid plain text or email in %s", (name, value) => {
    const form = new FormData();
    form.set(name, value);
    expect(parsePublicBusinessDetails(form).success).toBe(false);
  });
});
