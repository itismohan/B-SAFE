import { describe, expect, it } from "vitest";
import { createDefaultRunner, isBusinessValidTransaction, redactSecrets, serializeReport, SEVERITIES, sha256Hex, verifyDigest, isEvmAddress } from "../src";

describe("B-SAFE automation framework", () => {
  it("executes the complete ordered pipeline", async () => {
    const result = await createDefaultRunner().run({ runId: "RUN-TEST-001", risk: "HIGH", suites: ["Blockchain Transaction", "Reconciliation"], target: "synthetic-asset" });
    expect(result.status).toBe("PASSED");
    expect(result.stages).toEqual(["DISCOVER", "MODEL", "GENERATE", "EXECUTE", "OBSERVE", "VERIFY", "ATTACK", "RECONCILE", "ANALYZE", "REPORT"]);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it("requires every business-validity control to pass", () => {
    expect(isBusinessValidTransaction({ transactionValid: true, signatureValid: true, authorizationValid: true, assetStateValid: true, contractStateValid: true, ledgerStateValid: true, businessRulesValid: true, reconciliationValid: true })).toBe(true);
    expect(isBusinessValidTransaction({ transactionValid: true, signatureValid: true, authorizationValid: false, assetStateValid: true, contractStateValid: true, ledgerStateValid: true, businessRulesValid: true, reconciliationValid: true })).toBe(false);
  });

  it("redacts secrets before evidence serialization", () => {
    expect(redactSecrets("privateKey=abc123 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toContain("REDACTED");
    expect(redactSecrets("privateKey=abc123 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).not.toContain("abc123");
  });

  it("preserves the exact severity contract and validates cryptographic primitives", () => {
    expect(SEVERITIES).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
    const digest = sha256Hex("B-SAFE");
    expect(verifyDigest("B-SAFE", digest)).toBe(true);
    expect(isEvmAddress("0x0000000000000000000000000000000000000001")).toBe(true);
    expect(isEvmAddress("not-an-address")).toBe(false);
  });

  it("serializes technical evidence as SARIF", async () => {
    const result = await createDefaultRunner().run({ runId: "RUN-REPORT-001", risk: "LOW", suites: ["API Security"], target: "synthetic-api" });
    expect(serializeReport("SARIF", result)).toContain("B-SAFE Automation Framework");
  });
});


describe("proxy governance", () => {
  it("creates explicit findings for unauthorized and non-allowlisted upgrades", async () => {
    const { evaluateProxyUpgrade } = await import("../src");
    expect(evaluateProxyUpgrade({ caller: "0x1", admin: "0x2", implementation: "0xdead", allowlisted: true })).toMatchObject({ allowed: false, reason: "UNAUTHORIZED_CALLER", finding: { severity: "CRITICAL" } });
    expect(evaluateProxyUpgrade({ caller: "0x1", admin: "0x1", implementation: "0xdead", allowlisted: false })).toMatchObject({ allowed: false, reason: "IMPLEMENTATION_NOT_ALLOWLISTED", finding: { category: "Upgrade authorization" } });
  });
});


describe("SARIF CI annotations", () => {
  it("serializes blocked proxy locations for CI annotations", async () => {
    const result = await createDefaultRunner().run({ runId: "RUN-SARIF-LOCATION", risk: "CRITICAL", suites: ["Smart Contract"], target: "proxy" });
    const sarif = JSON.parse(serializeReport("SARIF", { ...result, findings: [{ id: "FND-PROXY", severity: "CRITICAL", category: "Upgrade authorization", component: "proxy", scenario: "blocked upgrade", expected: "allowlisted implementation", actual: "blocked", evidenceIds: [], remediation: "review authorization", locations: [{ uri: "automation/fixtures/UpgradeableProxy.sol", startLine: 1, startColumn: 1 }] }] }));
    expect(sarif.runs[0].results[0].locations[0].physicalLocation).toMatchObject({ artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } });
  });
});


describe("real proxy SARIF flow", () => {
  it("emits source locations from a blocked automation proxy finding", async () => {
    const { evaluateProxyUpgrade } = await import("../src");
    const decision = evaluateProxyUpgrade({ caller: "0xattacker", admin: "0xadmin", implementation: "0xblocked", allowlisted: true });
    expect(decision.finding).not.toBeNull();
    const result = await createDefaultRunner().run({ runId: "RUN-REAL-PROXY-SARIF", risk: "CRITICAL", suites: ["Smart Contract"], target: "proxy" });
    const finding = decision.finding!;
    const sarif = JSON.parse(serializeReport("SARIF", { ...result, findings: [{ id: "FND-REAL-PROXY", ...finding, scenario: "blocked proxy upgrade", evidenceIds: [], remediation: "review proxy authorization" }] }));
    expect(sarif.runs[0].results[0].locations[0].physicalLocation).toMatchObject({ artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } });
  });
});

describe("runner lifecycle controls", () => {
  it("emits callback-derived stage progress through the report stage", async () => {
    const events: Array<{ stage: string; progress: number; status: string }> = [];
    const result = await createDefaultRunner().run({ runId: "RUN-CALLBACK-001", risk: "LOW", suites: ["API Security"], target: "synthetic-api" }, { onProgress: event => events.push({ stage: event.stage, progress: event.progress, status: event.status }) });
    expect(events.some(event => event.stage === "EXECUTE" && event.status === "PASSED")).toBe(true);
    expect(events.at(-1)).toMatchObject({ stage: "REPORT", progress: 100, status: "PASSED" });
    expect(result.status).toBe("PASSED");
  });

  it("returns an aborted result when a cancellation signal is already set", async () => {
    const controller = new AbortController();
    controller.abort();
    const result = await createDefaultRunner().run({ runId: "RUN-CANCEL-001", risk: "HIGH", suites: ["Smart Contract"], target: "synthetic-contract", signal: controller.signal }, { onProgress: event => expect(event.status).toBe("ABORTED") });
    expect(result.status).toBe("ABORTED");
  });

  it("resumes at the requested pipeline stage instead of replaying prior stages", async () => {
    const result = await createDefaultRunner().run({ runId: "RUN-RESUME-001", risk: "MEDIUM", suites: ["Reconciliation"], target: "synthetic-ledger", resumeFromStage: "OBSERVE" });
    expect(result.status).toBe("PASSED");
    expect(result.stages[0]).toBe("OBSERVE");
    expect(result.stages).not.toContain("DISCOVER");
  });
});
