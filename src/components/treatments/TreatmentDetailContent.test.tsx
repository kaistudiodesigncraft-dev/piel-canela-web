import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { treatmentCategories, treatments } from "@/data/fixtures";
import { TreatmentDetailContent } from "./TreatmentDetailContent";

const treatment = treatments[0]!;
const category = treatmentCategories.find((item) => item.id === treatment.categoryId)!;

describe("TreatmentDetailContent presentation", () => {
  it("places the existing booking action before the extended content without losing information", () => {
    render(<TreatmentDetailContent treatment={treatment} category={category} />);

    const action = screen.getByRole("link", { name: "Iniciar reserva" });
    const details = screen.getByRole("heading", { name: "Qué podés esperar" });
    expect(action).toHaveAttribute("href", `/reservar?treatmentId=${treatment.id}`);
    expect(action.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Iniciar reserva" })).toHaveLength(1);
    expect(screen.getByText(treatment.description)).toBeInTheDocument();
    expect(screen.getByText(treatment.preparation!)).toBeInTheDocument();
    expect(screen.getByText(treatment.contraindications!)).toBeInTheDocument();
  });

  it("keeps the action available when the treatment has no image", () => {
    render(<TreatmentDetailContent treatment={{ ...treatment, image: null }} category={category} />);
    expect(screen.getByRole("heading", { level: 1, name: treatment.name })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar reserva" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("does not offer a public booking action in administrative preview", () => {
    render(<TreatmentDetailContent treatment={treatment} category={category} preview />);
    expect(screen.queryByRole("link", { name: "Iniciar reserva" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver a edición" })).toHaveAttribute("href", `/admin/catalogo#treatment-${treatment.id}`);
  });
});
