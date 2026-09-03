import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogAdmin, type AdminTreatmentRow } from "./CatalogAdmin";

vi.mock("@/app/admin/catalogo/actions", () => ({ updateTreatmentCategory: vi.fn() }));

const categoryId = "10000000-0000-4000-8000-000000000001";
const specialtyId = "20000000-0000-4000-8000-000000000001";
const categories = [{ id: categoryId, name: "Bienestar", slug: "bienestar", short_description: "Terapias y masajes para acompañar el bienestar cotidiano.", icon_name: "FlowerLotus", display_order: 1, is_active: true }];
const specialties = [{ id: specialtyId, name: "Masoterapia", is_active: true }];

function treatment(overrides: Partial<AdminTreatmentRow>): AdminTreatmentRow {
  return {
    id: "40000000-0000-4000-8000-000000000001", category_id: categoryId, specialty_id: specialtyId,
    professional_id: null, name: "Relajación profunda", slug: "relajacion-profunda",
    short_description: "Una sesión serena para acompañar el descanso.", description: "Una experiencia de bienestar con intensidad conversada.",
    expectations: [], characteristics: [], duration_minutes: 60, buffer_minutes: 15, start_interval_minutes: 30,
    price_cents: 6500000, preparation: null, contraindications: null, image_path: "/images/treatment-massage-concept.png",
    image_url: "/images/treatment-massage-concept.png", image_alt: "Sesión de masaje", image_focal_x: 0.5,
    image_focal_y: 0.5, is_active: true, display_order: 1, future_booking_count: 2, ...overrides,
  };
}

describe("CatalogAdmin", () => {
  it("keeps the list focused and routes editing to dedicated pages", async () => {
    const user = userEvent.setup();
    render(<CatalogAdmin categories={categories} specialties={specialties} professionals={[]} treatments={[
      treatment({}),
      treatment({ id: "40000000-0000-4000-8000-000000000002", name: "Borrador nuevo", is_active: false, image_path: null, image_url: null, image_alt: null }),
    ]} feedback={{}} />);

    expect(screen.getByRole("link", { name: /nuevo tratamiento/i })).toHaveAttribute("href", "/admin/catalogo/nuevo");
    expect(screen.getByRole("link", { name: /relajación profunda/i })).toHaveAttribute("href", "/admin/catalogo/40000000-0000-4000-8000-000000000001");
    expect(screen.queryByLabelText(/subir imagen/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Filtrar publicación"), "draft");
    expect(screen.queryByText("Relajación profunda")).not.toBeInTheDocument();
    expect(screen.getByText("Borrador nuevo")).toBeInTheDocument();
  });

  it("degrades booking impact without hiding treatments", () => {
    render(<CatalogAdmin categories={categories} specialties={specialties} professionals={[]} treatments={[treatment({})]} feedback={{}} bookingCountsAvailable={false} bookingCountsIncidentId="ABC123" />);
    expect(screen.getByText("Relajación profunda")).toBeInTheDocument();
    expect(screen.getByText(/no pudimos calcular el impacto/i)).toBeInTheDocument();
    expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    expect(screen.queryByText(/reservas futuras/)).not.toBeInTheDocument();
  });
});
