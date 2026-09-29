import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComboEditorForm } from "./ComboEditorForm";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/admin/catalogo/[id]/combos/actions", () => ({ saveTreatmentComboResult: save }));

function editor() {
  return render(<ComboEditorForm><label>Nombre<input name="name" defaultValue="Combo inicial" /></label></ComboEditorForm>);
}

describe("ComboEditorForm", () => {
  beforeEach(() => { save.mockReset(); });

  it("conserva el contenido cuando el servidor rechaza la publicación", async () => {
    save.mockResolvedValue({ status: "invalid", fieldErrors: { zoneIds: ["Seleccioná una zona"] }, message: "Revisá las zonas" });
    editor();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Mi combo" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar combo" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mi combo");
    expect(save.mock.calls[0]![0].get("isActive")).toBe("on");
  });

  it("bloquea envíos repetidos mientras espera y reutiliza el ID guardado", async () => {
    let complete!: (value: unknown) => void;
    save.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    editor();
    const button = screen.getByRole("button", { name: "Guardar borrador" });
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Publicar combo" })).toBeDisabled();
    complete({ status: "saved", comboId: "saved-combo", fieldErrors: {}, message: "Guardado" });
    await screen.findByRole("status");
    save.mockResolvedValue({ status: "saved", comboId: "saved-combo", fieldErrors: {}, message: "Publicado" });
    fireEvent.click(screen.getByRole("button", { name: "Publicar combo" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(save.mock.calls[0]![0].get("isActive")).toBe("off");
    expect(save.mock.calls[1]![0].get("comboId")).toBe("saved-combo");
  });

  it("preserva los valores y explica un resultado incierto de red", async () => {
    save.mockRejectedValue(new Error("offline"));
    editor();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Antes de repetir");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Combo inicial");
  });
});
