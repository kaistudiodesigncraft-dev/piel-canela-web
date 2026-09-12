import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SiteContentField } from "@/domain/site-content";
import { HomeHero } from "./HomeHero";

const image: SiteContentField = {
  key: "hero_image", section: "hero", kind: "image", label: "Portada",
  value: "/images/treatment-massage-concept.png", imagePath: null,
  imageAlt: "Imagen elegida por Piel Canela", displayOrder: 4, updatedAt: null,
  settings: { focalX: 23, focalY: 71, enabled: true, presentation: "content", surfacePreset: "soft", overlayPreset: "light" },
};
const copy = { eyebrow: "Estética y bienestar", title: "Tu contenido real", lead: "Texto escrito por el equipo.", caption: "Epígrafe editable." };

describe("HomeHero", () => {
  it("preserves client copy, image description, focal point and navigation", () => {
    render(<HomeHero {...copy} image={image} />);
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
    expect(screen.getByText(copy.caption)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: image.imageAlt! })).toHaveStyle({ objectPosition: "23% 71%" });
    expect(screen.getByRole("link", { name: /Explorar tratamientos/ })).toHaveAttribute("href", "/tratamientos");
  });

  it("honors disabled image without hiding content or introducing another photo", () => {
    render(<HomeHero {...copy} image={{ ...image, settings: { ...image.settings, enabled: false } }} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.title);
    expect(screen.getByRole("link", { name: /Explorar tratamientos/ })).toBeInTheDocument();
  });
});
