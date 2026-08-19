import { expect, test } from "@playwright/test";

test.describe("B-SAFE portal branding", () => {
  test("renders the supplied logo and favicon on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const logo = page.getByRole("img", { name: "B-SAFE logo" });
    await expect(logo).toBeVisible();
    await expect(page.locator(".brand-logo-frame")).toHaveCSS("border-radius", "50%");
    await expect(logo).toHaveCSS("object-fit", "contain");
    const box = await logo.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(30);
    expect(box?.height).toBeGreaterThanOrEqual(30);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /bsafe-logo_3057dd9c\.png/);
  });

  test("keeps the supplied logo visible in the collapsed mobile sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const logo = page.getByRole("img", { name: "B-SAFE logo" });
    await expect(logo).toBeVisible();
    await expect(page.locator(".brand-logo-frame")).toHaveCSS("border-radius", "50%");
    await expect(logo).toHaveCSS("object-fit", "contain");
    const box = await page.locator(".brand-logo-frame").boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(34);
    expect(box?.height).toBeGreaterThanOrEqual(34);
    expect(box?.width).toBeLessThanOrEqual(56);
    expect(box?.height).toBeLessThanOrEqual(56);
  });
});
