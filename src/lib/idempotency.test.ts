import { describe, expect, it } from "vitest";
import { idempotencyUuid } from "@/lib/idempotency";

describe("idempotencyUuid", () => {
  it("creates a stable valid UUID for a hydration-stable seed", () => {
    const first = idempotencyUuid(":R2l5:");
    expect(first).toBe(idempotencyUuid(":R2l5:"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("separates forms with different React ids", () => {
    expect(idempotencyUuid(":R1:")).not.toBe(idempotencyUuid(":R2:"));
  });
});
