import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAdminPassword } from "./actions";
const mocks = vi.hoisted(() => ({ claims: vi.fn(), profile: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ auth: { getClaims: mocks.claims, updateUser: mocks.update }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }) }) }));
describe("setAdminPassword", () => {
  beforeEach(() => {
    mocks.claims.mockResolvedValue({ data: { claims: { sub: "qa" } } });
    mocks.profile.mockResolvedValue({ data: { is_active: true, role: "manager" } });
    mocks.update.mockReset().mockResolvedValue({ error: null });
  });
  function run(password = "A-valid-password!", confirmation = password) {
    const form = new FormData(); form.set("password", password); form.set("passwordConfirmation", confirmation);
    return setAdminPassword({ status: "idle", message: "" }, form);
  }
  it("validates before accessing updateUser", async () => {
    expect((await run("short")).status).toBe("error"); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("allows active managers to choose their password", async () => { expect((await run()).status).toBe("saved"); });
  it("rejects accounts without an active operational profile", async () => {
    mocks.profile.mockResolvedValue({ data: { is_active: false, role: "manager" } });
    expect((await run()).status).toBe("error"); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("handles expired sessions and network errors without throwing", async () => {
    mocks.claims.mockResolvedValueOnce({ data: null }); expect((await run()).message).toMatch(/sesión venció/);
    mocks.update.mockRejectedValue(new Error("network")); expect((await run()).message).toMatch(/campos se conservan/);
  });
});
