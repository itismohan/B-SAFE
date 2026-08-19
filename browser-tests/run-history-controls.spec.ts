import { expect, test } from "@playwright/test";

const run = {
  id: "run_history_001",
  risk: "CRITICAL",
  profile: "critical-core",
  status: "CANCELLED",
  progress: 55,
  currentStage: "ATTACK",
  attempt: 1,
  cancelRequested: false,
  resumeFromStage: "RECONCILE",
  results: { suites: "04 / 08", gates: "02 / 05", findings: "00", evidence: "PARTIAL" },
  createdAt: "2026-08-18T12:00:00.000Z",
  updatedAt: "2026-08-18T12:00:04.000Z",
  isolation: { wallet: "wallet_test", asset: "asset_test", chainId: 31337 },
};

const snapshot = { score: 96, metrics: [], runs: [run], findings: [], audit: [] };

test("shows persisted run detail and resumable controls", async ({ page }) => {
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = decodeURIComponent(url.pathname.split("/api/trpc/")[1] ?? "").split(",");
    const body = procedures.map(procedure => {
      if (procedure.endsWith("dashboard.snapshot")) return { result: { data: { json: snapshot } } };
      if (procedure.endsWith("dashboard.runHistory")) return { result: { data: { json: { rows: [run], hasMore: false, nextOffset: null } } } };
      if (procedure.endsWith("dashboard.runDetail")) return { result: { data: { json: run } } };
      return { result: { data: { json: null } } };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.searchParams.get("batch") === "1" ? body : body[0]) });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Test runs" }).click();
  await expect(page.getByText("PERSISTED RUN HISTORY")).toBeVisible();
  await expect(page.getByRole("button", { name: /run_history_001 ATTACK/ })).toBeVisible();
  await expect(page.getByText("RUN DETAIL / run_history_001")).toBeVisible();
  await expect(page.getByRole("button", { name: "RESUME" })).toBeVisible();
  await expect(page.getByRole("button", { name: "NEXT" })).toBeDisabled();
});
