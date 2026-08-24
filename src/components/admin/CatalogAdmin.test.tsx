import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogAdmin, type AdminTreatmentRow } from "./CatalogAdmin";

vi.mock("@/app/admin/catalogo/actions", () => ({
  initialSaveTreatmentState: { status: "idle" },
  deleteTreatment: vi.fn(),
  saveTreatment: vi.fn(),
  updateTreatmentCategory: vi.fn(),
}));

const createObjectURL = vi.fn(() => "blob:tratamiento");
const revokeObjectURL = vi.fn();
Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });

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
    expect(screen.getAllByLabelText(/subir imagen/i)).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText("Filtrar publicación"), "draft");
    expect(screen.queryByText("Relajación profunda")).not.toBeInTheDocument();
    expect(screen.getByText("Tratamiento nuevo")).toBeInTheDocument();
  });

  it("requires publication-only fields when the draft is activated", async () => {
    const user = userEvent.setup();
    render(<CatalogAdmin
      categories={categories}
      specialties={specialties}
      professionals={professionals}
      treatments={[]}
      feedback={{}}
    />);

    const image = screen.getByLabelText(/subir imagen/i);
    const alt = screen.getByLabelText(/Descripción accesible/i);
    const price = screen.getByLabelText("Precio en pesos");
    expect(image).not.toBeRequired();
    expect(alt).not.toBeRequired();
    expect(price).toHaveAttribute("min", "0");

    await user.click(screen.getByLabelText("Publicar y habilitar reservas"));
    expect(image).toBeRequired();
    expect(alt).toBeRequired();
    expect(price).toHaveAttribute("min", "1");
  });

  it("shows image dimensions after validating a local preview", async () => {
    const user = userEvent.setup();
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 1080);
    view.setUint32(20, 1350);
    render(<CatalogAdmin
      categories={categories}
      specialties={specialties}
      professionals={professionals}
      treatments={[]}
      feedback={{}}
    />);

    await user.upload(screen.getByLabelText(/subir imagen/i), new File([bytes], "tratamiento.png", { type: "image/png" }));
    expect(await screen.findByText("Imagen lista: 1080 × 1350 px")).toBeInTheDocument();
    expect(screen.getByAltText("Vista previa de la imagen seleccionada")).toHaveStyle({ objectPosition: "50% 50%" });
  });

  it("keeps permanent deletion behind a separate confirmation area", async () => {
    const user = userEvent.setup();
    render(<CatalogAdmin
      categories={categories}
      specialties={specialties}
      professionals={professionals}
      treatments={[treatment({ future_booking_count: 0 })]}
      feedback={{}}
    />);

    await user.click(screen.getByText("Relajación profunda"));
    await user.click(screen.getByText("Eliminar tratamiento"));
    expect(screen.getByLabelText("Código de eliminación")).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText("Código de eliminación")).toBeRequired();
    expect(screen.getByLabelText(/Confirmo que quiero eliminar/)).toBeRequired();
    expect(screen.getByRole("button", { name: "Eliminar definitivamente" })).toBeEnabled();
  });
});
