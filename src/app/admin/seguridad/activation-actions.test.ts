import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwner: vi.fn(),
  createAdmin: vi.fn(),
  toDataURL: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin/require-admin", () => ({ requireOwner: mocks.requireOwner }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: mocks.createAdmin }));
vi.mock("qrcode", () => ({ default: { toDataURL: mocks.toDataURL } }));

import {
  generateManagerActivation,
  initialManagerActivationState,
} from "./activation-actions";

function activationForm(email = "responsable@example.com") {
  const form = new FormData();
  form.set("email", email);
  form.set("fullName", "Piel Canela");
  return form;
}

describe("generateManagerActivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://piel-canela.example";
    mocks.requireOwner.mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      supabase: { from: vi.fn() },
    });
    mocks.toDataURL.mockResolvedValue("data:image/png;base64,QR");
  });

  it("rejects invalid input before requesting an elevated client", async () => {
    const result = await generateManagerActivation(initialManagerActivationState, activationForm("correo-invalido"));
    expect(result).toMatchObject({ status: "error", error: "invalid" });
    expect(mocks.createAdmin).not.toHaveBeenCalled();
  });

  it("creates a manager profile and QR without using an email-sending method", async () => {
    const generateLink = vi.fn().mockResolvedValue({
      data: {
        properties: { action_link: "https://supabase.example/auth/v1/verify?token=one-time" },
        user: { id: "22222222-2222-4222-8222-222222222222" },
      },
      error: null,
    });
    const profileInsert = vi.fn().mockResolvedValue({ error: null });
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const adminFrom = vi.fn((table: string) => ({
      insert: table === "profiles" ? profileInsert : auditInsert,
    }));
    mocks.createAdmin.mockReturnValue({
      auth: { admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        generateLink,
        deleteUser: vi.fn(),
      } },
      from: adminFrom,
    });

    const result = await generateManagerActivation(initialManagerActivationState, activationForm());

    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "invite" }));
    expect(profileInsert).toHaveBeenCalledWith(expect.objectContaining({ role: "manager", is_active: true }));
    expect(auditInsert).toHaveBeenCalledWith(expect.objectContaining({ actor_id: "11111111-1111-4111-8111-111111111111" }));
    expect(result).toMatchObject({ status: "ready", activationKind: "invite", qrDataUrl: "data:image/png;base64,QR" });
  });

  it("refuses to generate a manager QR for an owner account", async () => {
    const existingUser = { id: "33333333-3333-4333-8333-333333333333", email: "responsable@example.com" };
    const generateLink = vi.fn();
    const ownerFrom = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: { full_name: "Kai", role: "admin", is_active: true }, error: null }),
        })),
      })),
    }));
    mocks.requireOwner.mockResolvedValue({ userId: existingUser.id, supabase: { from: ownerFrom } });
    mocks.createAdmin.mockReturnValue({
      auth: { admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: [existingUser] }, error: null }),
        generateLink,
      } },
    });

    const result = await generateManagerActivation(initialManagerActivationState, activationForm());
    expect(result).toEqual({ status: "error", error: "protected" });
    expect(generateLink).not.toHaveBeenCalled();
  });
});
