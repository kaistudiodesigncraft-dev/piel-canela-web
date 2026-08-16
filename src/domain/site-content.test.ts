import { describe, expect, it } from "vitest";
import {
  getDefaultSiteContent,
  SITE_CONTENT_DEFINITIONS,
  SITE_CONTENT_KEYS,
} from "./site-content";

describe("fixed site content contract", () => {
  it("contains one immutable definition for every allowed key", () => {
    expect(SITE_CONTENT_DEFINITIONS).toHaveLength(SITE_CONTENT_KEYS.length);
    expect(new Set(SITE_CONTENT_DEFINITIONS.map((field) => field.key)).size).toBe(SITE_CONTENT_KEYS.length);
  });

  it("keeps the editor limited to the five approved sections", () => {
    expect(new Set(SITE_CONTENT_DEFINITIONS.map((field) => field.section))).toEqual(
      new Set(["hero", "categories", "approach", "booking", "faq"]),
    );
  });

  it("provides accessible text for every image field", () => {
    const imageFields = getDefaultSiteContent().filter((field) => field.kind === "image");
    expect(imageFields.length).toBeGreaterThan(0);
    expect(imageFields.every((field) => Boolean(field.imageAlt?.trim()))).toBe(true);
  });
});
