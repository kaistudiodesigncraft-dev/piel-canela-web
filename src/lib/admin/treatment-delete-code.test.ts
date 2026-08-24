import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  hashTreatmentDeleteCode,
  isTreatmentDeleteCodeConfigured,
  verifyTreatmentDeleteCode,
} from "./treatment-delete-code";

const previousHash = process.env.TREATMENT_DELETE_CODE_HASH;

afterEach(() => {
  if (previousHash === undefined) delete process.env.TREATMENT_DELETE_CODE_HASH;
  else process.env.TREATMENT_DELETE_CODE_HASH = previousHash;
});

describe("treatment delete code", () => {
  it("compares the configured digest without storing the plaintext code", () => {
    process.env.TREATMENT_DELETE_CODE_HASH = hashTreatmentDeleteCode("2323");

    expect(isTreatmentDeleteCodeConfigured()).toBe(true);
    expect(verifyTreatmentDeleteCode("2323")).toBe(true);
    expect(verifyTreatmentDeleteCode("0000")).toBe(false);
  });

  it("fails closed when the digest is not configured", () => {
    delete process.env.TREATMENT_DELETE_CODE_HASH;

    expect(isTreatmentDeleteCodeConfigured()).toBe(false);
    expect(verifyTreatmentDeleteCode("2323")).toBe(false);
  });
});
