import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { treatmentCategories, treatments } from "@/data/fixtures";
import { TreatmentEditorialCard } from "./TreatmentEditorialCard";

describe("TreatmentEditorialCard", () => {
  it("shows specific editorial information and opens from its only action", async () => {
    const user = userEvent.setup();
    const treatment = treatments[0]!;
    const category = treatmentCategories.find((item) => item.id === treatment.categoryId)!;
    const onOpen = vi.fn();

    render(
      <TreatmentEditorialCard
        treatment={treatment}
        category={category}
        detailHref={`/tratamientos?treatment=${treatment.slug}`}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByRole("heading", { name: treatment.name })).toBeInTheDocument();
    expect(screen.getByText(treatment.shortDescription)).toBeInTheDocument();
    expect(screen.getByText("60 minutos")).toBeInTheDocument();

    const action = screen.getByRole("link", { name: `Ver detalles de ${treatment.name}` });
    expect(action).toHaveAttribute("href", `/tratamientos?treatment=${treatment.slug}`);
    action.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(action);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
