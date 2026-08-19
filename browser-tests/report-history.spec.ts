import { expect, test, type Page } from "@playwright/test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const artifactPath = path.join(process.cwd(), "reports", "browser-test.sarif");
const snapshot = {
  score: 96,
  metrics: [],
  runs: [],
  findings: [],
  audit: [
    {
      time: "12:00:00",
      action: "Nightly SARIF report ingested",
      actor: "SYSTEM",
      metadata: {
        source: "github-actions",
        format: "SARIF",
        generatedAt: "2026-08-18T12:00:00.000Z",
        artifactPath: "reports/browser-test.sarif",
        runId: "BROWSER-TEST-001",
        findingCount: 1,
      },
    },
  ],
};

async function mockSnapshot(page: Page) {
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedurePath = decodeURIComponent(
      url.pathname.split("/api/trpc/")[1] ?? ""
    );
    const procedures = procedurePath.split(",");
    if (
      !procedures.some(procedure => procedure.endsWith("dashboard.snapshot"))
    ) {
      await route.continue();
      return;
    }

    const body = procedures.map(procedure =>
      procedure.endsWith("dashboard.snapshot")
        ? { result: { data: { json: snapshot } } }
        : { result: { data: { json: null } } }
    );
    const responseBody = url.searchParams.get("batch") === "1" ? body : body[0];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responseBody),
    });
  });
}

test.describe("report history detail view", () => {
  test.beforeEach(async ({ page }) => {
    await mkdir(path.dirname(artifactPath), { recursive: true });
    await writeFile(artifactPath, '{"version":"2.1.0","runs":[]}');
    await mockSnapshot(page);
  });

  test.afterEach(async () => {
    await rm(artifactPath, { force: true });
  });

  test("opens an accessible dialog, filters records, and downloads a real artifact", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "VIEW HISTORY" }).click();
    const dialog = page.getByRole("dialog", { name: "Nightly report history" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Filter persisted CI evidence metadata/)
    ).toBeVisible();

    const runId = dialog.getByLabel("RUN ID");
    await runId.fill("NO-MATCH-RUN");
    await expect(
      dialog.getByText("No report records match the selected filters.")
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "PREVIOUS" })
    ).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "NEXT" })).toBeDisabled();

    await runId.fill("");
    await dialog.getByLabel("FORMAT").selectOption("SARIF");
    await expect(dialog.getByText(/PAGE 1 \/ 1/)).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("link", { name: /DOWNLOAD/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("browser-test.sarif");
  });

  test("closes with the labelled close control and exposes modal semantics", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "VIEW HISTORY" }).click();
    const dialog = page.getByRole("dialog", { name: "Nightly report history" });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await dialog.getByRole("button", { name: "Close report history" }).click();
    await expect(dialog).toBeHidden();
  });
});

test("filters report history by run ID, format, and source", async ({
  page,
}) => {
  await mockSnapshot(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "VIEW HISTORY" }).click();
  const dialog = page.getByRole("dialog", { name: "Nightly report history" });

  const firstReport = dialog.locator(".report-history-detail-row").first();
  await expect(firstReport).toBeVisible();
  await dialog.getByLabel("FORMAT").selectOption("SARIF");
  await dialog.getByLabel("SOURCE").selectOption("github-actions");
  await expect(
    dialog.locator(".report-history-detail-row").first()
  ).toBeVisible();

  const filteredReport = dialog.locator(".report-history-detail-row").first();
  const runId = (
    await filteredReport.locator("div").first().locator("span").textContent()
  )?.trim();
  expect(runId).toBeTruthy();
  await dialog.getByLabel("RUN ID").fill(runId!);
  await expect(
    dialog.locator(".report-history-detail-row").first()
  ).toBeVisible();

  await dialog.getByLabel("RUN ID").fill("UNKNOWN-RUN");
  await expect(
    dialog.getByText("No report records match the selected filters.")
  ).toBeVisible();

  await dialog.getByRole("button", { name: "CLEAR FILTERS" }).click();
  await expect(
    dialog.locator(".report-history-detail-row").first()
  ).toBeVisible();
});
