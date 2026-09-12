import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ComboSessionFields } from "./ComboSessionFields";

describe("ComboSessionFields", () => {
  it("only submits package fields for packages and retains edits when switching", async () => {
    const user = userEvent.setup();
    const { container } = render(<form><ComboSessionFields initialMode="single_session" sessionCount={6} validityDays={120} /></form>);
    expect(new FormData(container.querySelector("form")!).has("sessionCount")).toBe(false);
    await user.selectOptions(screen.getByLabelText("Modalidad"), "package");
    expect(screen.getByLabelText("Cantidad de sesiones")).toBeRequired();
    expect(screen.getByLabelText("Cantidad de sesiones")).toHaveValue(6);
    await user.clear(screen.getByLabelText("Vigencia en días"));
    await user.type(screen.getByLabelText("Vigencia en días"), "180");
    await user.selectOptions(screen.getByLabelText("Modalidad"), "single_session");
    expect(new FormData(container.querySelector("form")!).has("validityDays")).toBe(false);
    await user.selectOptions(screen.getByLabelText("Modalidad"), "package");
    expect(screen.getByLabelText("Vigencia en días")).toHaveValue(180);
  });
});
