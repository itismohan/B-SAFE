import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const databaseConfigured = Boolean(process.env.DATABASE_URL);
const describeDatabase = databaseConfigured ? describe : describe.skip;

const caller = () =>
  appRouter.createCaller({
    user: {
      id: 1,
      openId: "database-test",
      email: "database@example.com",
      name: "Database Test",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });

const adminCaller = () =>
  appRouter.createCaller({
    user: {
      id: 2,
      openId: "database-admin-test",
      email: "database-admin@example.com",
      name: "Database Admin",
      loginMethod: "test",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });

describeDatabase("dashboard database persistence", () => {
  it("stores ingested SARIF findings and exposes report metadata in the snapshot", async () => {
    const { ingestNightlyReport } = await import("./reportIngestion");
    const runId = `TEST-CI-${Date.now()}`;
    await ingestNightlyReport({
      runId,
      format: "SARIF",
      artifactPath: "reports/test.sarif",
      content: JSON.stringify({
        runs: [
          {
            results: [
              {
                ruleId: `BATCH-LEDGER-${Date.now()}`,
                level: "error",
                message: { text: "batch mismatch" },
                locations: [],
              },
            ],
          },
        ],
      }),
    });

    const snapshot = await caller().dashboard.snapshot();
    expect(
      snapshot.findings.some(
        finding =>
          finding.category.startsWith("BATCH-LEDGER-") ||
          finding.category === "BATCH-LEDGER"
      )
    ).toBe(true);
    expect(
      snapshot.audit.some(
        event =>
          event.metadata?.runId === runId && event.metadata?.format === "SARIF"
      )
    ).toBe(true);
  });

  it("prunes expired reports and retains a deletion audit tombstone", async () => {
    const { ingestNightlyReport } = await import("./reportIngestion");
    const runId = `RUN-EXPIRED-${Date.now()}`;
    await ingestNightlyReport({
      runId,
      format: "SARIF",
      artifactPath: "reports/expired.sarif",
      generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      retentionDays: 1,
      content: JSON.stringify({ runs: [{ results: [] }] }),
    });

    const result = await adminCaller().dashboard.pruneReportHistory({
      retentionDays: 1,
    });
    expect(result.status).toBe("PRUNED");
    expect(result.deleted).toBeGreaterThanOrEqual(1);

    const snapshot = await caller().dashboard.snapshot();
    expect(
      snapshot.audit.some(
        event =>
          event.action === `Report ${runId}/SARIF deleted` &&
          event.metadata?.runId === runId
      )
    ).toBe(true);
    expect(
      snapshot.audit.some(
        event =>
          event.metadata?.runId === runId &&
          event.metadata?.format === "SARIF" &&
          event.action.startsWith("Nightly")
      )
    ).toBe(false);
  });
});

if (!databaseConfigured) {
  console.warn(
    "Database integration suite skipped: set DATABASE_URL to run MySQL persistence checks."
  );
}
