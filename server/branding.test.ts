import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const managedLogoPath = "/manus-storage/bsafe-logo_3057dd9c.png";

describe("portal branding", () => {
  it("keeps the complete managed logo path in portal metadata without deployment secrets", async () => {
    const indexHtml = await readFile(
      resolve(process.cwd(), "client/index.html"),
      "utf8"
    );

    expect(indexHtml).toContain(`href="${managedLogoPath}"`);
    expect(indexHtml).toContain(`content="${managedLogoPath}"`);
  });
});
