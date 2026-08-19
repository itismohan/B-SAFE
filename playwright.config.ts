import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  timeout: 15000,
  use: {
    baseURL: process.env.BSAFE_BROWSER_BASE_URL ?? "http://127.0.0.1:3000",
    browserName: "chromium",
    ...devices["Desktop Chrome"],
  },
  reporter: [["list"]],
});
