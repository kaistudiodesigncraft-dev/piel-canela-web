import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GovernanceAdmin, type AdminProfileRow } from "./GovernanceAdmin";

vi.mock("@/app/admin/seguridad/actions", () => ({ updateAdminProfile: vi.fn() }));

const profiles: AdminProfileRow[] = [
  { user_id: "11111111-1111-4111-8111-111111111111", full_name: "Kai Studio", role: "admin", is_active: true, created_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-20T10:00:00Z" },
  { user_id: "22222222-2222-4222-8222-222222222222", full_name: "Piel Canela", role: "manager", is_active: false, created_at: "2026-08-20T10:00:00Z", updated_at: "2026-08-20T10:00:00Z" },
];

const currentUserId = "11111111-1111-4111-8111-111111111111";

const events = [{
  id: 1,
  actor_id: currentUserId,
  table_name: "bookings",
  record_id: "33333333-3333-4333-8333-333333333333",
  action: "update" as const,
  old_data: { status: "pending", internal_notes: "dato anterior privado" },
  new_data: { status: "confirmed", internal_notes: "dato nuevo privado" },
  created_at: "2026-08-21T13:00:00Z",
}];

describe("GovernanceAdmin", () => {
  it("protege la cuenta actual y oculta valores privados de la auditoría", () => {
    render(<GovernanceAdmin currentUserId={currentUserId} profiles={profiles} events={events} feedback={{}} />);
    expect(screen.getByText("Sesión actual")).toBeInTheDocument();
    expect(screen.getAllByRole("combobox")[0]).toBeDisabled();
    expect(screen.getByDisplayValue("Gestión del cliente")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Edición en Reservas"));
    expect(screen.getAllByText("Estado").length).toBeGreaterThan(0);
    expect(screen.getByText("Contenido protegido actualizado")).toBeInTheDocument();
    expect(screen.queryByText("dato nuevo privado")).not.toBeInTheDocument();
  });

  it("filtra la actividad sin exponer el detalle del registro", () => {
    render(<GovernanceAdmin currentUserId={currentUserId} profiles={profiles} events={events} feedback={{}} />);
    fireEvent.change(screen.getByPlaceholderText("Buscar persona, sección o referencia"), { target: { value: "sin coincidencia" } });
    expect(screen.getByText("No hay actividad para este filtro.")).toBeInTheDocument();
  });
});
