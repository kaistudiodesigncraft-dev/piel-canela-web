import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn((location: string): never => { throw new Error(`NEXT_REDIRECT:${location}`); }),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/admin/require-admin", () => ({ requireAdmin: async () => ({ supabase: { rpc: mocks.rpc } }) }));
vi.mock("@/lib/admin/treatment-delete-code", () => ({
  isTreatmentDeleteCodeConfigured: () => true,
  verifyTreatmentDeleteCode: () => true,
}));

import { removeCatalogEntry } from "./removal-actions";

function removalForm(entity = "treatment", disposition = "delete") {
  const form = new FormData();
  form.set("entity", entity);
  form.set("id", "37000000-0000-4000-8000-000000000001");
  form.set("updatedAt", "2026-10-17T18:00:00.000Z");
  form.set("disposition", disposition);
  form.set("confirmationCode", "2323");
  form.set("confirm", "on");
  form.set("versions", "[]");
  if (disposition === "reassign") form.set("replacementId", "37000000-0000-4000-8000-000000000002");
  return form;
}

function mockOutcome(outcome: "deleted" | "archived") {
  mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce({ data: { outcome }, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
}

describe("catalog removal action navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockReset();
    vi.stubEnv("BOOKING_GUARD_SECRET", "g".repeat(32));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("redirects away from a deleted editor instead of rendering a 404", async () => {
    mockOutcome("deleted");
    await expect(removeCatalogEntry({ status: "idle", message: "" }, removalForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/catalogo?treatmentDeleted=1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/catalogo");
  });

  it("preserves the reassignment explanation on the destination listing", async () => {
    mockOutcome("deleted");
    await expect(removeCatalogEntry({ status: "idle", message: "" }, removalForm("treatment", "reassign"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/catalogo?treatmentDeleted=1&specialsPreserved=1");
  });

  it("keeps an archived editor open with confirmation", async () => {
    mockOutcome("archived");
    const result = await removeCatalogEntry({ status: "idle", message: "" }, removalForm("treatment", "archive"));
    expect(result).toMatchObject({ status: "done", message: expect.stringContaining("Archivado") });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not navigate away when only a special was removed", async () => {
    mockOutcome("deleted");
    const result = await removeCatalogEntry({ status: "idle", message: "" }, removalForm("special"));
    expect(result.status).toBe("done");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps database failures visible without redirecting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "40001", message: "catalog_removal_stale" } });
    const result = await removeCatalogEntry({ status: "idle", message: "" }, removalForm());
    expect(result.status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
