import { afterEach, describe, expect, it, vi } from "vitest";

describe("report artifact storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects a malformed Forge endpoint before making a network request", async () => {
    vi.resetModules();
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "forge.internal");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "test-forge-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { storageGetSignedUrl } = await import("./storage");

    await expect(
      storageGetSignedUrl("bsafe-reports/RUN-001/bsafe.sarif")
    ).rejects.toThrow(
      "Storage config invalid: BUILT_IN_FORGE_API_URL must be an absolute HTTP(S) URL"
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requests a signed S3 GET URL for a retained report key", async () => {
    vi.resetModules();
    vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://forge.test");
    vi.stubEnv("BUILT_IN_FORGE_API_KEY", "test-forge-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ url: "https://s3.example.test/signed-report" }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const { storageGetSignedUrl } = await import("./storage");

    await expect(
      storageGetSignedUrl("bsafe-reports/RUN-001/bsafe.sarif")
    ).resolves.toBe("https://s3.example.test/signed-report");

    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.origin).toBe("https://forge.test");
    expect(requestUrl.pathname).toBe("/v1/storage/presign/get");
    expect(requestUrl.searchParams.get("path")).toBe(
      "bsafe-reports/RUN-001/bsafe.sarif"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer test-forge-key" },
    });
  });
});
