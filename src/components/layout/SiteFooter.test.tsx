import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("shows recognizable social logos with accessible destinations", () => {
    render(
      <SiteFooter
        settings={{
          whatsappNumber: "5493517677404",
          address: "Córdoba",
          publicEmail: "espaciopielcanela@gmail.com",
          instagramUrl: "https://www.instagram.com/pielcanela/",
          depositText: null,
          cancellationPolicy: null,
          receptionHours: null,
        }}
      />,
    );

    const whatsapp = screen.getByRole("link", { name: /abrir whatsapp de piel canela/i });
    const instagram = screen.getByRole("link", { name: /abrir instagram de piel canela/i });

    expect(whatsapp).toHaveAttribute("href", "https://wa.me/5493517677404");
    expect(instagram).toHaveAttribute("href", "https://www.instagram.com/pielcanela/");
    expect(whatsapp.querySelector("svg")).toBeInTheDocument();
    expect(instagram.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "espaciopielcanela@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:espaciopielcanela@gmail.com",
    );
  });
});
