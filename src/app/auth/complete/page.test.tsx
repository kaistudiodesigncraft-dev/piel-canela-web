import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CompleteAuthPage from "./page";
const mocks = vi.hoisted(() => ({ exchange: vi.fn(), session: vi.fn(), set: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { exchangeCodeForSession: mocks.exchange, getSession: mocks.session, setSession: mocks.set } }) }));
describe("CompleteAuthPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.exchange.mockResolvedValue({ error: null });
    mocks.session.mockResolvedValue({ data: { session: { user: { id: "qa" } } }, error: null });
  });
  it("exchanges single-use codes once in Strict Mode and preserves recovery context", async () => {
    window.history.replaceState(null, "", "/auth/complete?code=single-use&flow=recovery");
    render(<StrictMode><CompleteAuthPage /></StrictMode>);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/auth/set-password?flow=recovery"));
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(window.location.search).toBe("");
  });
  it("offers a fresh recovery link when the callback expired", async () => {
    window.history.replaceState(null, "", "/auth/complete#error_description=expired");
    render(<CompleteAuthPage />);
    await screen.findByText("No pudimos validar el enlace");
    expect(screen.getByRole("link", { name: "Solicitar un nuevo enlace" })).toHaveAttribute("href", "/auth/recuperar");
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
});
