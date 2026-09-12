import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/whatsapp/server", () => ({ createWhatsAppAdminClient: mocks.create }));
import { POST as worker } from "@/app/api/whatsapp/worker/route";
import { POST as webhook, GET as verifyWebhook } from "@/app/api/whatsapp/webhook/route";

describe("WhatsApp HTTP boundaries (no provider requests)", () => {
  beforeEach(() => { mocks.create.mockReset(); vi.stubEnv("WHATSAPP_WORKER_SECRET", "s".repeat(32)); vi.stubEnv("WHATSAPP_AUTOMATION_ENABLED", "false"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("rejects unauthenticated worker calls before database access", async () => {
    expect((await worker(new Request("https://test/api/whatsapp/worker", { method: "POST" }))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("disabled flag prevents queue and network access even for authorized scheduler", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await worker(new Request("https://test", { method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` } }));
    expect(await response.json()).toEqual({ enabled: false });
    expect(mocks.create).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("fails closed when enabled without provider configuration", async () => {
    vi.stubEnv("WHATSAPP_AUTOMATION_ENABLED", "true"); vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    expect((await worker(new Request("https://test", { method: "POST", headers: { authorization: `Bearer ${"s".repeat(32)}` } }))).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects spoofed webhook before database access", async () => {
    expect((await webhook(new Request("https://test", { method: "POST", body: "{}" }))).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("handles authenticated null payload without crashing or storing content", async () => {
    const secret = "a".repeat(32); vi.stubEnv("WHATSAPP_APP_SECRET", secret);
    mocks.create.mockReturnValue({ from: vi.fn() });
    const body = "null";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    expect((await webhook(new Request("https://test", { method: "POST", body, headers: { "x-hub-signature-256": signature } }))).status).toBe(200);
  });
  it("verifies challenge only against configured strong token", async () => {
    const token = "v".repeat(32); vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", token);
    const response = await verifyWebhook(new Request(`https://test?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=123`));
    expect(await response.text()).toBe("123");
    expect((await verifyWebhook(new Request("https://test?hub.mode=subscribe&hub.verify_token=wrong"))).status).toBe(403);
  });
});
