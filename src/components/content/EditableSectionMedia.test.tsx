import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getDefaultSiteContent } from "@/domain/site-content";
import { EditableSectionMedia, editableSurfaceClassName } from "./EditableSectionMedia";

describe("EditableSectionMedia", () => {
  const background = getDefaultSiteContent().find((field) => field.key === "categories_background")!;
  const enabledBackground = {
    ...background,
    value: "/images/treatment-massage-concept.png",
    settings: { ...background.settings, enabled: true },
  };

  it("uses the approved focal point and keeps a section background decorative", () => {
    const field = { ...enabledBackground, settings: { ...enabledBackground.settings, focalX: 28, focalY: 64 } };
    const { container } = render(<EditableSectionMedia field={field} />);
    const image = container.querySelector("img");

    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveStyle({ objectPosition: "28% 64%" });
  });

  it("does not render disabled or empty media", () => {
    const disabled = { ...background, settings: { ...background.settings, enabled: false } };
    const { container } = render(<EditableSectionMedia field={disabled} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("derives only the allowed surface and overlay classes", () => {
    expect(editableSurfaceClassName("section", enabledBackground)).toContain("editable-overlay--light");
    expect(editableSurfaceClassName("section", enabledBackground)).toContain("editable-surface--soft");
  });
});
