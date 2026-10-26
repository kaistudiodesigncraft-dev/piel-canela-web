import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { preventImplicitFormSubmit } from "./form-safety";

describe("preventImplicitFormSubmit", () => {
  it("requires an explicit action instead of submitting from a text field", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onKeyDown={preventImplicitFormSubmit} onSubmit={submit}><label>Nombre<input /></label><button type="submit">Publicar</button></form>);
    fireEvent.keyDown(screen.getByLabelText("Nombre"), { key: "Enter" });
    expect(submit).not.toHaveBeenCalled();
  });

  it("keeps textarea line breaks and explicit button activation available", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onKeyDown={preventImplicitFormSubmit} onSubmit={submit}><label>Descripción<textarea /></label><button type="submit">Guardar</button></form>);
    const lineBreak = fireEvent.keyDown(screen.getByLabelText("Descripción"), { key: "Enter" });
    expect(lineBreak).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
