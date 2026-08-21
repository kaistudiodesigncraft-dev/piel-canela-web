import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogAdmin, type AdminTreatmentRow } from "./CatalogAdmin";

vi.mock("@/app/admin/catalogo/actions", () => ({
  saveTreatment: vi.fn(),
  updateTreatmentCategory: vi.fn(),
}));

const categoryId = "10000000-0000-4000-8000-000000000001";
const specialtyId = "20000000-0000-4000-8000-000000000001";
const professionalId = "30000000-0000-4000-8000-000000000001";
const categories = [{
  id: categoryId,
  name: "Bienestar",
  slug: "bienestar",
  short_description: "Terapias y masajes para acompañar el bienestar cotidiano.",
  icon_name: "FlowerLotus",
  display_order: 1,
  is_active: true,
}];
const specialties = [{ id: specialtyId, name: "Masoterapia", is_active: true }];
const professionals = [{ id: professionalId, specialty_id: specialtyId, full_name: "Laura Pérez", public_name: "Laura", is_active: true }];

function treatment(overrides: Partial<AdminTreatmentRow>): AdminTreatmentRow {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    category_id: categoryId,
    specialty_id: specialtyId,
    professional_id: professionalId,
    name: "Relajación profunda",
    slug: "relajacion-profunda",
    short_description: "Una sesión serena para acompañar el descanso.",
    description: "Una experiencia de bienestar con intensidad conversada antes de comenzar.",
    expectations: ["Consulta inicial"],
    characteristics: ["Presión adaptable"],
    duration_minutes: 60,
    buffer_minutes: 15,
    price_cents: 6500000,
    preparation: null,
    contraindications: null,
    image_path: "/images/treatment-massage-concept.png",
    image_url: "/images/treatment-massage-concept.png",
    image_alt: "Sesión de masaje de bienestar",
    image_focal_x: 0.5,
    image_focal_y: 0.5,
    is_active: true,
    display_order: 1,
    future_booking_count: 2,
    ...overrides,
  };
}

describe("CatalogAdmin", () => {
  it("filters published treatments and incomplete drafts", async () => {
    const user = userEvent.setup();
    render(<CatalogAdmin
      categories={categories}
      specialties={specialties}
      professionals={professionals}
      treatments={[
        treatment({}),
        treatment({ id: "40000000-0000-4000-8000-000000000002", name: "Tratamiento nuevo", slug: "tratamiento-nuevo", is_active: false, image_path: null, image_url: null, image_alt: null }),
      ]}
      feedback={{}}
    />);

    expect(screen.getByText("Relajación profunda")).toBeInTheDocument();
    expect(screen.getByText("Tratamiento nuevo")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtrar publicación"), "draft");
    expect(screen.queryByText("Relajación profunda")).not.toBeInTheDocument();
    expect(screen.getByText("Tratamiento nuevo")).toBeInTheDocument();
  });
});
