import { afterEach, describe, expect, it, vi } from "vitest";

describe("report artifact storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests a signed S3 GET URL for a retained report key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ url: "https://s3.example.test/signed-report" }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { storageGetSignedUrl } = await import("./storage");
    await expect(storageGetSignedUrl("bsafe-reports/RUN-001/bsafe.sarif")).resolves.toBe("https://s3.example.test/signed-report");
    const requestUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(requestUrl.pathname).toBe("/v1/storage/presign/get");
    expect(requestUrl.searchParams.get("path")).toBe("bsafe-reports/RUN-001/bsafe.sarif");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: expect.stringMatching(/^Bearer /) } });
  });
});
