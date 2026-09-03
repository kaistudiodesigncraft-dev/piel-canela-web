import { describe, expect, it } from "vitest";
import {
  getDefaultSiteContent,
  getSiteContentCharacterLimit,
  SITE_CONTENT_DEFINITIONS,
  SITE_CONTENT_KEYS,
} from "./site-content";

describe("fixed site content contract", () => {
  it("contains one immutable definition for every allowed key", () => {
    expect(SITE_CONTENT_DEFINITIONS).toHaveLength(SITE_CONTENT_KEYS.length);
    expect(new Set(SITE_CONTENT_DEFINITIONS.map((field) => field.key)).size).toBe(SITE_CONTENT_KEYS.length);
  });

  it("keeps the editor limited to the eight approved fixed sections", () => {
    expect(new Set(SITE_CONTENT_DEFINITIONS.map((field) => field.section))).toEqual(
      new Set(["hero", "categories", "specials", "approach", "booking", "faq", "catalog_header", "booking_header"]),
    );
  });

  it("provides accessible text for content images and marks decorative assets as backgrounds", () => {
    const imageFields = getDefaultSiteContent().filter((field) => field.kind === "image");
    expect(imageFields.length).toBeGreaterThan(0);
    expect(imageFields.every((field) => field.settings.presentation === "background" || Boolean(field.imageAlt?.trim()))).toBe(true);
    expect(imageFields.filter((field) => field.settings.presentation === "background").every((field) => !field.settings.enabled)).toBe(true);
  });

  it("uses composition-aware limits instead of one generic text maximum", () => {
    const fields = getDefaultSiteContent();
    const heroTitle = fields.find((field) => field.key === "hero_title");
    const stepTitle = fields.find((field) => field.key === "booking_step_1_title");
    const approachBody = fields.find((field) => field.key === "approach_body_primary");
    expect(heroTitle && getSiteContentCharacterLimit(heroTitle)).toBe(96);
    expect(stepTitle && getSiteContentCharacterLimit(stepTitle)).toBe(40);
    expect(approachBody && getSiteContentCharacterLimit(approachBody)).toBe(700);
  });
});
