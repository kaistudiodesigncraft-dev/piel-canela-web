import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  monthlySpecials,
  treatmentCategories,
  treatments,
} from "@/data/fixtures";
import { CatalogExperience } from "./CatalogExperience";

const router = { replace: vi.fn() };
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/tratamientos",
  useSearchParams: () => currentSearchParams,
}));

describe("CatalogExperience filters", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    router.replace.mockReset();
  });

  it("shows all active treatments when there is no filter", () => {
    render(
      <CatalogExperience
        categories={treatmentCategories}
        treatments={treatments}
        monthlySpecials={monthlySpecials}
      />,
    );

    expect(screen.getByText("6 tratamientos")).toBeInTheDocument();
  });

  it("applies the category reflected in the URL", () => {
    currentSearchParams = new URLSearchParams("category=bienestar");
    render(
      <CatalogExperience
        categories={treatmentCategories}
        treatments={treatments}
        monthlySpecials={monthlySpecials}
      />,
    );

    expect(screen.getByRole("heading", { name: "Bienestar", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("2 tratamientos")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Evaluación kinésica" })).not.toBeInTheDocument();
  });

  it("links to a treatment without losing the active category", () => {
    currentSearchParams = new URLSearchParams("category=bienestar");
    render(
      <CatalogExperience
        categories={treatmentCategories}
        treatments={treatments}
        monthlySpecials={monthlySpecials}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Ver detalles de Relajación profunda" }),
    ).toHaveAttribute(
      "href",
      "/tratamientos?category=bienestar&treatment=relajacion-profunda",
    );
  });
});
