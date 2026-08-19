import { describe, expect, it } from "vitest";

describe("portal branding", () => {
  it("uses the supplied managed logo path and serves it through the storage endpoint", async () => {
    const logoPath = process.env.VITE_APP_LOGO;
    expect(logoPath).toBe("/manus-storage/bsafe-logo_3057dd9c.png");
    const response = await fetch(`http://127.0.0.1:3000${logoPath}`);
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toMatch(/image\/png/);
  });
});
