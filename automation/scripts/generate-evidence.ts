import { mkdir, writeFile } from "node:fs/promises";
import { createDefaultRunner, serializeReport } from "../src";

const result = await createDefaultRunner().run({ runId: `CI-${new Date().toISOString().replace(/[:.]/g, "-")}`, risk: "LOW", suites: ["Blockchain Transaction", "Reconciliation"], target: "controlled-hardhat" });
await mkdir("reports", { recursive: true });
await Promise.all([
  writeFile("reports/bsafe.sarif", serializeReport("SARIF", result)),
  writeFile("reports/bsafe.junit.xml", serializeReport("JUnit", result)),
  writeFile("reports/bsafe.json", serializeReport("JSON", result)),
  writeFile("reports/bsafe.html", serializeReport("HTML", result)),
]);
console.log(`Evidence package generated for ${result.runId}`);
