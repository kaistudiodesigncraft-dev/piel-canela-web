import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  monthlySpecials,
  treatmentCategories,
  treatments,
} from "@/data/fixtures";
import { MonthlySpecialsSection } from "./MonthlySpecialsSection";

describe("MonthlySpecialsSection", () => {
  it("does not render a section when there are no monthly specials", () => {
    const { container } = render(
      <MonthlySpecialsSection
        specials={[]}
        treatments={treatments}
        categories={treatmentCategories}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses the feature treatment when there is exactly one special", () => {
    render(
      <MonthlySpecialsSection
        specials={monthlySpecials.slice(0, 1)}
        treatments={treatments}
        categories={treatmentCategories}
      />,
    );

    expect(screen.getByRole("heading", { name: "Pausa profunda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver especial/i })).toHaveAttribute(
      "href",
      expect.stringContaining("monthlySpecial=special-pausa-profunda"),
    );
  });

  it("renders two to four specials as a finite grid", () => {
    render(
      <MonthlySpecialsSection
        specials={monthlySpecials}
        treatments={treatments}
        categories={treatmentCategories}
      />,
    );

    expect(screen.getAllByRole("link", { name: /ver especial/i })).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Recuperación activa" })).toBeInTheDocument();
  });
});

