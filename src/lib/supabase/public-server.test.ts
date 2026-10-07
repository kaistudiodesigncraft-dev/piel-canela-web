import { describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: client }));
vi.mock("./env", () => ({ getSupabasePublicConfig: () => ({ url: "https://example.supabase.co", publishableKey: "public-test-key" }) }));
import { createSupabasePublicServerClient } from "./public-server";

describe("public Supabase fetch", () => {
  it("does not persist a stale empty catalog across publication changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    try {
      createSupabasePublicServerClient();
      const options = client.mock.calls[0]![2];
      await options.global.fetch("https://example.supabase.co/rest/v1/treatment_combos", { headers: { apikey: "public-test-key" }, cache: "force-cache" });
      expect(fetchMock).toHaveBeenCalledWith(expect.any(String), {
        headers: { apikey: "public-test-key" }, cache: "no-store",
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
