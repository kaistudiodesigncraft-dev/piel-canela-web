import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ProfessionalSaveForm } from "./ProfessionalSaveForm";

vi.mock("@/app/admin/profesionales/actions", () => ({
  saveProfessional: vi.fn(async () => ({ error: "No se guardó; revisá la especialidad." })),
}));

it("keeps written data and focuses feedback after a failed save", async () => {
  const user = userEvent.setup();
  render(<ProfessionalSaveForm><label>Nombre<input name="fullName" /></label></ProfessionalSaveForm>);
  await user.type(screen.getByLabelText("Nombre"), "Nombre conservado");
  await user.click(screen.getByRole("button", { name: "Guardar profesional" }));
  expect(await screen.findByRole("alert")).toHaveFocus();
  expect(screen.getByLabelText("Nombre")).toHaveValue("Nombre conservado");
  expect(screen.getByRole("button", { name: "Guardar profesional" })).toBeEnabled();
});
