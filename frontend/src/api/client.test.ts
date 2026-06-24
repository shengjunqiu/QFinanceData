import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, buildApiUrl, isApiError } from "./client";

describe("apiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds relative API URLs with query params", () => {
    expect(buildApiUrl("/api/symbols", { include_disabled: true, group_name: "Core" })).toBe(
      "/api/symbols?include_disabled=true&group_name=Core"
    );
  });

  it("returns parsed JSON for successful requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ symbol: "AAPL" }), {
          headers: { "content-type": "application/json" },
          status: 200
        })
      )
    );

    await expect(apiRequest<{ symbol: string }>("/api/symbols/AAPL")).resolves.toEqual({ symbol: "AAPL" });
  });

  it("returns undefined for 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiRequest<void>("/api/symbols/AAPL", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("normalizes backend detail errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "symbol already exists" }), {
          headers: { "content-type": "application/json" },
          status: 409
        })
      )
    );

    await expect(apiRequest("/api/symbols", { method: "POST" })).rejects.toMatchObject({
      message: "symbol already exists",
      status: 409
    });
  });

  it("normalizes network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Failed to fetch")));

    try {
      await apiRequest("/api/symbols");
      throw new Error("Expected request to fail.");
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(0);
    }
  });
});
