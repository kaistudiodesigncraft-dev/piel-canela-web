import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeHero } from "./HomeHero";
import type { SiteContentField } from "@/domain/site-content";

const copy = { eyebrow: "Estética y bienestar", title: "Tu contenido real", lead: "Texto escrito por el equipo.", caption: "Nuestro espacio" };
const image: SiteContentField = {
  key: "hero_image", section: "hero", kind: "image", label: "Portada",
  value: "/images/treatment-massage-concept.png", imagePath: null,
  imageAlt: "Foto elegida por Piel Canela", displayOrder: 4, updatedAt: null,
  settings: { focalX: 23, focalY: 71, enabled: true, presentation: "content", surfacePreset: "soft", overlayPreset: "light" },
};

describe("HomeHero", () => {
  it("preserves editable copy and navigation with the official brand composition", () => {
    render(<HomeHero {...copy} image={image} />);
    expect(screen.getByRole("img", { name: image.imageAlt! })).toHaveStyle({ objectPosition: "23% 71%" });
    expect(screen.getByText(copy.caption)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeInTheDocument();
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reservar tratamiento" })).toHaveAttribute("href", "/tratamientos");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Consultar/ })).not.toBeInTheDocument();
  });

  it("respects the image visibility configured by the client", () => {
    render(<HomeHero {...copy} image={{ ...image, settings: { ...image.settings, enabled: false } }} />);
    expect(screen.queryByRole("img", { name: image.imageAlt! })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(copy.title);
  });

});
