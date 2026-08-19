import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts", "automation/**/*.test.ts", "automation/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "coverage",
      include: ["server/{dashboard,db,reportIngestion,proxyGovernance,storage,routers}.ts", "automation/src/**/*.ts"],
      exclude: ["**/*.d.ts", "**/_core/**", "automation/fixtures/**"],
      thresholds: {
        lines: 60,
        functions: 45,
        statements: 60,
        branches: 45,
      },
    },
  },
});
