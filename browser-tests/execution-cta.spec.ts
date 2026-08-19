import { expect, test } from "@playwright/test";

test.describe("execution CTA flow", () => {
  test("launches a Critical Run and presents execution results", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      class BrowserExecutionSocket {
        onopen: (() => void) | null = null;
        onerror: (() => void) | null = null;
        onclose: (() => void) | null = null;
        onmessage: ((event: MessageEvent<string>) => void) | null = null;
        constructor() {
          setTimeout(() => this.onopen?.(), 50);
          setTimeout(
            () =>
              this.onmessage?.({
                data: JSON.stringify({
                  time: new Date().toISOString(),
                  level: "INFO",
                  message: "CRITICAL PIPELINE RUNNING",
                  status: "RUNNING",
                  progress: 55,
                  results: {
                    suites: "04 / 08",
                    gates: "03 / 05",
                    findings: "01",
                    evidence: "OPEN",
                  },
                }),
              } as MessageEvent<string>),
            900
          );
          setTimeout(
            () =>
              this.onmessage?.({
                data: JSON.stringify({
                  time: new Date().toISOString(),
                  level: "INFO",
                  message: "EXECUTION RESULTS SEALED",
                  status: "PASSED",
                  progress: 100,
                  results: {
                    suites: "08 / 08",
                    gates: "05 / 05",
                    findings: "00",
                    evidence: "SEALED",
                  },
                }),
              } as MessageEvent<string>),
            2200
          );
        }
        close() {
          this.onclose?.();
        }
      }
      window.WebSocket = BrowserExecutionSocket as unknown as typeof WebSocket;
    });
    await page.route("**/api/trpc/**", async route => {
      const url = route.request().url();
      if (!url.includes("dashboard.createRun")) {
        await route.continue();
        return;
      }
      const payload = {
        result: {
          data: { json: { runId: "run_browser_critical", status: "QUEUED" } },
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(url.includes("batch=1") ? [payload] : payload),
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /NEW TEST RUN/ }).click();
    await expect(
      page.getByRole("heading", { name: "Authorize a security run" })
    ).toBeVisible();
    await expect(page.getByText("READY TO PROVISION")).toBeVisible();
    await expect(page.getByText("CRITICAL CORE FLOWS")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "LAUNCH CRITICAL RUN" })
    ).toBeVisible();
    await page.getByRole("button", { name: "LAUNCH CRITICAL RUN" }).click();

    await expect(
      page.getByRole("heading", { name: "Test runs", level: 1 })
    ).toBeVisible();
    await expect(
      page.getByText("CRITICAL RUN / EXECUTION RESULTS")
    ).toBeVisible();
    await expect
      .poll(
        async () => {
          const body = await page.locator("body").innerText();
          return (
            body.includes("Critical run in progress") ||
            body.includes("Critical run completed")
          );
        },
        { timeout: 5000 }
      )
      .toBe(true);
    const executionPanel = page.locator(".execution-results-panel");
    const alreadyCompleted = await page
      .getByText("Critical run completed")
      .isVisible()
      .catch(() => false);
    if (!alreadyCompleted) {
      await expect(
        executionPanel.getByText("RUNNING", { exact: true })
      ).toBeVisible();
    }

    await expect(page.getByText("Critical run completed")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("PASSED", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /VIEW EVIDENCE/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /RUN AGAIN/ })).toBeVisible();
  });
});

test("shows an actionable error when the Critical Run cannot be queued", async ({
  page,
}) => {
  await page.route("**/api/trpc/**", async route => {
    if (!route.request().url().includes("dashboard.createRun")) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: { json: { message: "Run authorization failed" } },
      }),
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /NEW TEST RUN/ }).click();
  await page.getByRole("button", { name: "LAUNCH CRITICAL RUN" }).click();

  await expect(page.getByText("Critical run failed")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Verify authorization and try again"
  );
});
