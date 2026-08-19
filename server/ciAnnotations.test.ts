import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseSarif } from "./reportIngestion";

describe("GitHub SARIF annotation contract", () => {
  it("publishes the minimal workflow fixture with code-scanning permissions", async () => {
    const workflow = await readFile(new URL("../.github/workflows/fixtures/sarif-annotation.yml", import.meta.url), "utf8");
    expect(workflow).toContain("security-events: write");
    expect(workflow).toContain("github/codeql-action/upload-sarif@v3");
    expect(workflow).toContain("sarif_file: reports/bsafe.sarif");
    expect(workflow).toContain("category: bsafe-hardhat");
  });

  it("recognizes a blocked proxy SARIF result with its source location", () => {
    const findings = parseSarif(JSON.stringify({ version: "2.1.0", runs: [{ results: [{ ruleId: "FND-REAL-PROXY", level: "error", message: { text: "Unauthorized proxy upgrade" }, locations: [{ physicalLocation: { artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } } }] }] }] }));
    expect(findings[0]?.locations?.[0]).toMatchObject({ physicalLocation: { artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } } });
  });
});
