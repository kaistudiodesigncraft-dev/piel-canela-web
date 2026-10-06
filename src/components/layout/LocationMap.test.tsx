import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocationMap } from "./LocationMap";

describe("LocationMap", () => {
  it("renders the lazy Google map with an accessible title and directions", () => {
    render(<LocationMap />);
    const map = screen.getByTitle("Mapa de Piel Canela en Espacio O2, sede Cofico");
    expect(map).toHaveAttribute("loading", "lazy");
    expect(map).toHaveAttribute("src", expect.stringContaining("google.com/maps/embed"));
    expect(screen.getByRole("link", { name: /Abrir indicaciones en Google Maps/i })).toHaveAttribute("target", "_blank");
  });
});
