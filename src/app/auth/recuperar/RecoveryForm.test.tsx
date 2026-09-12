import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecoveryForm } from "./RecoveryForm";

const reset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { resetPasswordForEmail: reset } }) }));
describe("RecoveryForm", () => {
  beforeEach(() => { reset.mockReset(); });
  function submit() {
    fireEvent.change(screen.getByLabelText("Correo de tu cuenta"), { target: { value: "qa@example.test" } });
    fireEvent.click(screen.getByRole("button"));
  }
  it("uses a fixed callback and neutral response without exposing account existence", async () => {
    reset.mockResolvedValue({ error: { status: 400, code: "user_not_found" } });
    render(<RecoveryForm />); submit();
    await screen.findByText(/Si el correo tiene una cuenta/);
    expect(reset).toHaveBeenCalledWith("qa@example.test", { redirectTo: `${window.location.origin}/auth/complete?flow=recovery` });
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("preserves email and releases pending after network failure", async () => {
    reset.mockRejectedValue(new Error("network"));
    render(<RecoveryForm />); submit();
    await screen.findByText(/No pudimos conectar/);
    expect(screen.getByLabelText("Correo de tu cuenta")).toHaveValue("qa@example.test");
    expect(screen.getByRole("button")).toBeEnabled();
  });
  it("prevents simultaneous submissions and acknowledges native throttling", async () => {
    let finish!: (value: unknown) => void;
    reset.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<RecoveryForm />); submit();
    fireEvent.submit(screen.getByLabelText("Correo de tu cuenta").closest("form")!);
    expect(reset).toHaveBeenCalledTimes(1);
    finish({ error: { status: 429 } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Esperá unos minutos"));
  });
});
