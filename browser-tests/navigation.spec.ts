import { expect, test } from "@playwright/test";

const primaryViews = [
  ["Command center", "Command center"],
  ["Test runs", "Test runs"],
  ["Test engine", "Test engine"],
  ["Findings", "Findings"],
  ["Reconciliation", "Reconciliation"],
  ["Evidence & reports", "Evidence & reports"],
] as const;

test.describe("primary sidebar navigation", () => {
  test("switches each primary item to its dedicated dashboard view", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    for (const [label, heading] of primaryViews) {
      const navItem = page.getByRole("button", { name: new RegExp(`^${label}`) }).first();
      await navItem.click();
      await expect(navItem).toHaveClass(/is-active/);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.locator(".breadcrumb strong")).toHaveText(label.toUpperCase());
    }
  });

  test("keeps the command-center view available after navigating away and back", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Findings/ }).click();
    await expect(page.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: /^Command center/ }).click();
    await expect(page.getByRole("heading", { name: "Command center", level: 1 })).toBeVisible();
    await expect(page.getByText("Quality & blockchain metrics")).toBeVisible();
  });
});
