import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { treatmentCategories, treatments } from "@/data/fixtures";
import { TreatmentDetailDialog } from "./TreatmentDetailDialog";

describe("TreatmentDetailDialog", () => {
  it("stays open when React Strict Mode replays effects", () => {
    const treatment = treatments[0]!;
    const category = treatmentCategories.find((item) => item.id === treatment.categoryId)!;
    const onClose = vi.fn();

    render(
      <StrictMode>
        <TreatmentDetailDialog
          treatment={treatment}
          category={category}
          onClose={onClose}
        />
      </StrictMode>,
    );

    expect(
      screen.getByRole("dialog", { name: `Detalle de ${treatment.name}` }),
    ).toHaveAttribute("open");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("opens as a modal and closes through an accessible control", async () => {
    const user = userEvent.setup();
    const treatment = treatments[0]!;
    const category = treatmentCategories.find((item) => item.id === treatment.categoryId)!;
    const onClose = vi.fn();

    render(
      <TreatmentDetailDialog
        treatment={treatment}
        category={category}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: `Detalle de ${treatment.name}` });
    expect(dialog).toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    expect(dialog).toHaveClass("is-closing");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes through the native cancel event used by Escape", async () => {
    const treatment = treatments[0]!;
    const category = treatmentCategories.find((item) => item.id === treatment.categoryId)!;
    const onClose = vi.fn();

    render(
      <TreatmentDetailDialog
        treatment={treatment}
        category={category}
        onClose={onClose}
      />,
    );

    fireEvent(
      screen.getByRole("dialog", { name: `Detalle de ${treatment.name}` }),
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
