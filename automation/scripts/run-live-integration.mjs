import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const outputFile = "artifacts/live-integration-vitest.json";
await mkdir("artifacts", { recursive: true });
const args = ["exec", "vitest", "run", "automation/tests/evm.integration.test.ts", "automation/tests/token-lifecycle.integration.test.ts", "automation/tests/erc1155-proxy.integration.test.ts", "--reporter=json", `--outputFile=${outputFile}`];
const child = spawn("pnpm", args, { stdio: "inherit", env: { ...process.env, BSAFE_EVM_INTEGRATION: "true" } });
const exitCode = await new Promise(resolve => child.on("close", resolve));
if (exitCode !== 0) process.exit(exitCode ?? 1);
const report = JSON.parse(await readFile(outputFile, "utf8"));
const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const skipped = report.numPendingTests ?? 0;
if (total !== 5 || passed !== 5 || skipped !== 0) {
  console.error(`Live Hardhat integration assertion failed: expected 5 passed / 0 skipped, received ${passed} passed / ${skipped} skipped / ${total} total.`);
  process.exit(1);
}
console.log(`Live Hardhat integration assertion passed: ${passed}/${total} scenarios executed with no skips.`);
