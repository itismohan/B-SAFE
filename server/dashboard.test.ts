import { describe, expect, it } from "vitest";
import { cancelTestRun, createTestRun, reportFormatSchema, retryTestRun, resumeTestRun, runDetail, runHistoryPage, severitySchema, testRunInputSchema } from "./dashboard";

describe("dashboard control-plane contracts", () => {
  it("accepts only the exact severity labels", () => {
    expect(severitySchema.parse("CRITICAL")).toBe("CRITICAL");
    expect(severitySchema.parse("HIGH")).toBe("HIGH");
    expect(severitySchema.parse("MEDIUM")).toBe("MEDIUM");
    expect(severitySchema.parse("LOW")).toBe("LOW");
    expect(() => severitySchema.parse("critical")).toThrow();
  });

  it("creates a queued run with isolated resources", () => {
    const input = testRunInputSchema.parse({ risk: "CRITICAL", parallel: true, profile: "critical-core" });
    const run = createTestRun(input);
    expect(run.status).toBe("QUEUED");
    expect(run.isolation.chainId).toBe(31337);
    expect(run.isolation.wallet).toMatch(/^wallet_/);
    expect(run.isolation.asset).toMatch(/^asset_/);
  });

  it("supports the required report formats", () => {
    expect(["HTML", "JSON", "JUnit", "SARIF"].map(value => reportFormatSchema.parse(value))).toEqual(["HTML", "JSON", "JUnit", "SARIF"]);
  });
});

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const caller = () => appRouter.createCaller({
  user: { id: 1, openId: "analyst-test", email: "analyst@example.com", name: "Analyst Test", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("dashboard procedures", () => {
  it("returns the control-plane snapshot with score and required metrics", async () => {
    const snapshot = await caller().dashboard.snapshot();
    expect(snapshot.score).toBe(96);
    expect(snapshot.metrics.map(metric => metric.label)).toContain("Reconciliation mismatches");
    expect(["CRITICAL", "HIGH"]).toContain(snapshot.findings[0]?.severity);
  }, 15000);

  it("queues a run through the typed procedure with isolated chain state", async () => {
    const run = await caller().dashboard.createRun({ risk: "HIGH", parallel: false, profile: "adversarial" });
    expect(run.status).toBe("QUEUED");
    expect(run.risk).toBe("HIGH");
    expect(run.isolation.chainId).toBe(31337);
  });

  it("queues each required evidence report format", async () => {
    const result = await caller().dashboard.requestReport("SARIF");
    expect(result).toEqual({ format: "SARIF", status: "QUEUED" });
  });
});

  it("saves an authenticated suite configuration", async () => {
    const result = await caller().dashboard.configureSuite({ suiteName: "Smart Contract", enabled: true, profile: "critical-core" });
    expect(result).toMatchObject({ suiteName: "Smart Contract", enabled: true, profile: "critical-core", status: "SAVED" });
  });


describe("reconciliation evidence procedures", () => {
  it("persists an aligned event-to-ledger evidence record through the protected procedure", async () => {
    const result = await caller().dashboard.persistReconciliation({
      evidenceKey: `TEST-EVIDENCE-${Date.now()}`,
      assetType: "ERC-1155",
      transactionHash: "0xlocal-test",
      eventCount: 1,
      expectedLedger: { tokenId: "1", quantity: "4" },
      observedLedger: { tokenId: "1", quantity: "4" },
      aligned: true,
    });
    expect(result.status).toBe("ALIGNED");
  });
});


describe("derived ledger reconciliation", () => {
  it("rejects unequal structured ledgers instead of trusting the supplied aligned flag", async () => {
    const result = await caller().dashboard.persistReconciliation({
      evidenceKey: `TEST-MISMATCH-${Date.now()}`,
      assetType: "ERC-1155",
      transactionHash: "0xlocal-mismatch",
      eventCount: 1,
      expectedLedger: { tokenId: "1", quantity: "4" },
      observedLedger: { tokenId: "1", quantity: "3" },
      aligned: true,
    });
    expect(result.status).toBe("MISMATCH");
    expect(result.mismatches).toContain("structured ledger payload mismatch");
  });
});


import { parseJunit, parseSarif } from "./reportIngestion";
describe("nightly report ingestion", () => {
  it("maps SARIF results and JUnit failures into dashboard finding records", () => {
    const sarif = parseSarif(JSON.stringify({ runs: [{ results: [{ ruleId: "PROXY-UPGRADE", level: "error", message: { text: "implementation not allowlisted" }, locations: [{ physicalLocation: { artifactLocation: { uri: "SimpleProxy" } } }] }] }] }));
    expect(sarif[0]).toMatchObject({ severity: "LOW", category: "PROXY-UPGRADE", component: "SimpleProxy", status: "OPEN" });
    const junit = parseJunit('<testsuite><testcase name="blocked upgrade" classname="SimpleProxy"><failure message="blocked" /></testcase></testsuite>');
    expect(junit[0]).toMatchObject({ severity: "HIGH", category: "CI integration failure", component: "SimpleProxy" });
  });
});


describe("nightly report persistence", () => {
  it("stores ingested SARIF findings and exposes report metadata in the dashboard snapshot", async () => {
    const { ingestNightlyReport } = await import("./reportIngestion");
    const runId = `TEST-CI-${Date.now()}`;
    await ingestNightlyReport({ runId, format: "SARIF", artifactPath: "reports/test.sarif", content: JSON.stringify({ runs: [{ results: [{ ruleId: `BATCH-LEDGER-${Date.now()}`, level: "error", message: { text: `batch mismatch ${Date.now()}` }, locations: [] }] }] }) });
    const snapshot = await caller().dashboard.snapshot();
    expect(snapshot.findings.some(finding => finding.category.startsWith("BATCH-LEDGER-") || finding.category === "BATCH-LEDGER")).toBe(true);
    expect(snapshot.audit.some(event => event.metadata?.runId === runId && event.metadata?.format === "SARIF")).toBe(true);
  });
});


describe("protected proxy governance procedure", () => {
  const governanceInput = { proxyAddress: `0xproxy-${Date.now()}`, caller: "0xattacker", admin: "0xadmin", implementation: "0ximpl-blocked", allowlisted: false };

  it("rejects unauthenticated callers before governance evaluation", async () => {
    const unauthenticated = appRouter.createCaller({ user: undefined, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
    await expect(unauthenticated.dashboard.enforceProxyUpgrade(governanceInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("persists a critical finding when an authenticated upgrade is blocked", async () => {
    const result = await caller().dashboard.enforceProxyUpgrade(governanceInput);
    expect(result).toMatchObject({ allowed: false, reason: "UNAUTHORIZED_CALLER" });
    expect(result.finding).toMatchObject({ severity: "CRITICAL", category: "Upgrade authorization", status: "OPEN" });
  });

  it("persists a critical finding for an authenticated non-allowlisted implementation", async () => {
    const result = await caller().dashboard.enforceProxyUpgrade({ ...governanceInput, proxyAddress: `0xproxy-${Date.now()}-allowlist`, caller: "0xadmin", allowlisted: false });
    expect(result).toMatchObject({ allowed: false, reason: "IMPLEMENTATION_NOT_ALLOWLISTED" });
    expect(result.finding?.actualBehavior).toContain("IMPLEMENTATION_NOT_ALLOWLISTED");
    expect(result.finding?.locations?.[0]).toMatchObject({ physicalLocation: { artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } } });
  });
});


const adminRetentionCaller = () => appRouter.createCaller({
  user: { id: 2, openId: "admin-retention-test", email: "admin-retention@example.com", name: "Admin Retention", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("report retention controls", () => {
  const adminCaller = () => appRouter.createCaller({
    user: { id: 2, openId: "admin-test", email: "admin@example.com", name: "Admin Test", loginMethod: "test", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });

  it("allows administrators to delete a report history record with a retention audit contract", async () => {
    const result = await adminCaller().dashboard.deleteReportHistory({ runId: "RUN-RETENTION-001", format: "SARIF" });
    expect(result).toMatchObject({ runId: "RUN-RETENTION-001", format: "SARIF", status: "DELETED" });
    expect(result.deletedAt).toEqual(expect.any(String));
  });

  it("denies report deletion to non-administrator operators", async () => {
    await expect(caller().dashboard.deleteReportHistory({ runId: "RUN-RETENTION-002", format: "JUnit" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});


describe("report retention pruning", () => {
  it("prunes expired reports and keeps the deletion audit event visible", async () => {
    const { ingestNightlyReport } = await import("./reportIngestion");
    const runId = `RUN-EXPIRED-${Date.now()}`;
    await ingestNightlyReport({ runId, format: "SARIF", artifactPath: "reports/expired.sarif", generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), retentionDays: 1, content: JSON.stringify({ runs: [{ results: [] }] }) });
    const result = await adminRetentionCaller().dashboard.pruneReportHistory({ retentionDays: 1 });
    expect(result.status).toBe("PRUNED");
    expect(result.deleted).toBeGreaterThanOrEqual(1);
    const snapshot = await caller().dashboard.snapshot();
    expect(snapshot.audit.some(event => event.action === `Report ${runId}/SARIF deleted` && event.metadata?.runId === runId)).toBe(true);
    expect(snapshot.audit.some(event => event.metadata?.runId === runId && event.metadata?.format === "SARIF" && event.action.startsWith("Nightly"))).toBe(false);
  }, 15000);
});

describe("run control and history", () => {
  it("cancels a queued run and exposes its persisted detail state", async () => {
    const run = createTestRun({ risk: "HIGH", parallel: false, profile: "critical-core" });
    const cancellation = await cancelTestRun(run.id);
    expect(cancellation.status).toBe("CANCEL_REQUESTED");
    await new Promise(resolve => setTimeout(resolve, 50));
    expect((await runDetail(run.id))?.status).toBe("CANCELLED");
  });

  it("retries a cancelled run through the same control-plane record", async () => {
    const run = createTestRun({ risk: "MEDIUM", parallel: true, profile: "adversarial" });
    await cancelTestRun(run.id);
    await new Promise(resolve => setTimeout(resolve, 25));
    const retried = await retryTestRun(run.id);
    expect(retried.attempt).toBeGreaterThan(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect((await runDetail(run.id))?.status).toBe("PASSED");
  });

  it("returns a bounded run-history page with a continuation indicator", async () => {
    const page = await runHistoryPage(2, 0);
    expect(page.rows.length).toBeLessThanOrEqual(2);
    expect(typeof page.hasMore).toBe("boolean");
  });
});

describe("execution result persistence", () => {
  it("updates the dashboard snapshot from queued to sealed results", async () => {
    const run = createTestRun({ risk: "CRITICAL", parallel: true, profile: "critical-core" });
    await new Promise(resolve => setTimeout(resolve, 2200));
    const snapshot = await (await import("./dashboard")).dashboardSnapshot();
    const observed = snapshot.runs.find(candidate => candidate.id === run.id);

    expect(observed).toMatchObject({ status: "PASSED", progress: 100 });
    expect(observed?.results).toEqual({ suites: "08 / 08", gates: "05 / 05", findings: "00", evidence: "SEALED" });
  }, 10000);
});
