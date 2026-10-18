import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CatalogRemovalDialog } from "./CatalogRemovalDialog";

vi.mock("@/app/admin/removal-actions", () => ({ removeCatalogEntry: vi.fn() }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

const source = { entity: "treatment" as const, id: "30000000-0000-4000-8000-000000000001", name: "Masaje", updatedAt: "2026-10-17T12:00:00Z" };

describe("protected catalog removal", () => {
  it("offers explicit deletion or reassignment when only specials are linked", async () => {
    const user = userEvent.setup();
    render(<CatalogRemovalDialog {...source} specialVersions={[{ id: "40000000-0000-4000-8000-000000000001", updatedAt: source.updatedAt }]}
      replacementTargets={[{ id: "30000000-0000-4000-8000-000000000002", name: "Otro masaje", selection_mode: "simple" }]} />);
    await user.click(screen.getByRole("button", { name: "Eliminar o archivar tratamiento" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Eliminar tratamiento y sus especiales")).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText("Desvincular y conservar los especiales"));
    expect(within(dialog).getByRole("combobox")).toBeRequired();
    expect(within(dialog).getByRole("option", { name: "Otro masaje" })).toBeInTheDocument();
    expect(within(dialog).getByText(/se conservarán pausados/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Código de seguridad")).toBeRequired();
  });

  it("offers only archive when there is historical use", async () => {
    render(<CatalogRemovalDialog {...source} hasHistory />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar o archivar tratamiento" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Archivar tratamiento y sus especiales")).toBeChecked();
    expect(within(dialog).queryByLabelText(/eliminar tratamiento definitivamente/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/desvincular/i)).not.toBeInTheDocument();
  });

  it("fails closed when the authoritative usage lookup is unavailable", () => {
    render(<CatalogRemovalDialog {...source} usageAvailable={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar o archivar tratamiento" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("No podemos verificar el estado actual");
    expect(screen.queryByRole("button", { name: "Confirmar acción" })).not.toBeInTheDocument();
  });

  it("offers independent special removal with preservation of historical reservations", () => {
    render(<CatalogRemovalDialog entity="special" id={source.id} name="Promo" updatedAt={source.updatedAt} />);
    fireEvent.click(screen.getByRole("button", { name: "Eliminar especial" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Si este especial tiene reservas, se archivará");
    expect(screen.getByRole("button", { name: "Confirmar acción" })).toBeInTheDocument();
  });
});
