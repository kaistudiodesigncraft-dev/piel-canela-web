import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DepilationZoneEditorForm } from "./DepilationZoneEditorForm";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/admin/catalogo/[id]/combos/actions", () => ({ saveDepilationZoneResult: save }));

function editor() {
  return render(<DepilationZoneEditorForm submitLabel="Crear zona">
    <input type="hidden" name="treatmentId" value="40000000-0000-4000-8000-000000000099" />
    <label>Nombre de la zona<input name="name" defaultValue="Piernas" /></label>
    <label>Valor individual<input name="referencePricePesos" defaultValue="12000" /></label>
  </DepilationZoneEditorForm>);
}

describe("DepilationZoneEditorForm", () => {
  beforeEach(() => { save.mockReset(); });

  it("conserva los datos cuando la zona no se puede guardar", async () => {
    save.mockResolvedValue({ status: "failed", fieldErrors: { name: ["Ya existe una zona con ese nombre."] }, message: "Nombre duplicado" });
    editor();
    fireEvent.change(screen.getByLabelText("Nombre de la zona"), { target: { value: "Pierna completa" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear zona" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nombre duplicado");
    expect(screen.getByLabelText("Nombre de la zona")).toHaveValue("Pierna completa");
  });

  it("bloquea envíos repetidos y reutiliza el ID guardado", async () => {
    let complete!: (value: unknown) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    editor();
    const button = screen.getByRole("button", { name: "Crear zona" });
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
    complete({ status: "saved", zoneId: "60000000-0000-4000-8000-000000000001", fieldErrors: {}, message: "Zona creada" });
    await screen.findByRole("status");
    save.mockResolvedValue({ status: "saved", zoneId: "60000000-0000-4000-8000-000000000001", fieldErrors: {}, message: "Zona actualizada" });
    fireEvent.click(screen.getByRole("button", { name: "Crear zona" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[1]![0].get("zoneId")).toBe("60000000-0000-4000-8000-000000000001");
  });

  it("explica un resultado incierto sin limpiar el formulario", async () => {
    save.mockRejectedValue(new Error("offline"));
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Crear zona" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Antes de repetir");
    expect(screen.getByLabelText("Nombre de la zona")).toHaveValue("Piernas");
  });
});
