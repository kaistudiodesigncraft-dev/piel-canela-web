import { describe, expect, it } from "vitest";
import { isSameDocumentNavigation } from "./use-unsaved-changes-guard";

describe("isSameDocumentNavigation", () => {
  it("allows anchors within the same page", () => {
    expect(isSameDocumentNavigation(
      "https://piel-canela.test/admin/contenido?mode=edit#hero",
      "#faq",
    )).toBe(true);
  });

  it("does not treat another query or route as the same document", () => {
    expect(isSameDocumentNavigation(
      "https://piel-canela.test/admin/catalogo/1",
      "https://piel-canela.test/admin/catalogo/2",
    )).toBe(false);
    expect(isSameDocumentNavigation(
      "https://piel-canela.test/admin/catalogo/1?tab=copy",
      "?tab=agenda",
    )).toBe(false);
  });
});
