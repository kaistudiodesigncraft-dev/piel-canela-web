import { describe, expect, it, vi } from "vitest";
import { createSupportCode, reportOperationalEvent } from "./observability";

describe("operational observability", () => {
  it("creates compact, shareable support codes", () => {
    expect(createSupportCode()).toMatch(/^[A-F0-9]{8}$/);
  });

  it("logs only the fixed operational schema and normalizes tokens", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    reportOperationalEvent({ event: "admin loaded", stage: "catalog\nemail@example.com", code: "ok", durationMs: 12.6, itemCount: 4 });
    const payload = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(payload).toEqual({ event: "admin_loaded", stage: "redacted", code: "ok", durationMs: 13, itemCount: 4 });
    expect(JSON.stringify(payload)).not.toContain("example.com");
    info.mockRestore();
  });
});
