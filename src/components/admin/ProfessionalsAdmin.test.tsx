import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfessionalsAdmin } from "./ProfessionalsAdmin";

vi.mock("@/app/admin/profesionales/actions", () => ({
  deleteProfessional: vi.fn(),
  saveProfessional: vi.fn(),
}));

const specialty = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Masoterapia",
  is_active: true,
};

function professional(overrides: Record<string, unknown> = {}) {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    specialty_id: specialty.id,
    specialty_ids: [specialty.id],
    full_name: "Laura Profesional",
    public_name: "Laura",
    phone: null,
    bio: null,
    internal_notes: null,
    is_active: true,
    display_order: 1,
    assigned_treatment_count: 0,
    booking_count: 0,
    ...overrides,
  };
}

describe("ProfessionalsAdmin", () => {
  it("offers guarded deletion only for an unlinked professional", async () => {
    const user = userEvent.setup();
    render(<ProfessionalsAdmin specialties={[specialty]} professionals={[professional()]} feedback={{}} />);

    await user.click(screen.getByText("Laura"));
    await user.click(screen.getByText("Eliminar profesional"));
    expect(screen.getByLabelText("Código de eliminación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminar definitivamente/i })).toBeInTheDocument();
  });

  it("preserves linked professionals and explains why they cannot be deleted", async () => {
    const user = userEvent.setup();
    render(<ProfessionalsAdmin specialties={[specialty]} professionals={[professional({ assigned_treatment_count: 2, booking_count: 4 })]} feedback={{}} />);

    await user.click(screen.getByText("Laura"));
    await user.click(screen.getByText("Eliminar profesional"));
    expect(screen.getByText("No se puede eliminar este perfil.")).toBeInTheDocument();
    expect(screen.getByText(/2 tratamientos asignados y 4 turnos registrados/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Código de eliminación")).not.toBeInTheDocument();
  });
});
