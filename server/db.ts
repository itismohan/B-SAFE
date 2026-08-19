import { desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, testRuns, auditEvents, dashboardMetrics, suiteConfigurations, securityFindings, reconciliationEvidence } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type TestRunStatus = "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED";
export type TestRunUpdate = { status?: TestRunStatus; progress?: number; currentStage?: string; attempt?: number; cancelRequested?: boolean; resumeFromStage?: string | null; parentRunKey?: string | null; results?: unknown };

export async function persistTestRun(run: { id: string; risk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; profile: string; parallel: boolean; status: TestRunStatus; progress?: number; currentStage?: string; attempt?: number; cancelRequested?: boolean; resumeFromStage?: string | null; parentRunKey?: string | null; results?: unknown; isolation: { wallet: string; asset: string; chainId: number } }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(testRuns).values({ runKey: run.id, risk: run.risk, profile: run.profile, parallel: run.parallel ? 1 : 0, status: run.status, progress: run.progress ?? 0, currentStage: run.currentStage ?? "QUEUED", attempt: run.attempt ?? 1, cancelRequested: run.cancelRequested ? 1 : 0, resumeFromStage: run.resumeFromStage ?? null, parentRunKey: run.parentRunKey ?? null, resultMetadata: run.results ? JSON.stringify(run.results) : null, isolationWallet: run.isolation.wallet, isolationAsset: run.isolation.asset, chainId: run.isolation.chainId });
}

export async function updateTestRun(runId: string, update: TestRunUpdate) {
  const db = await getDb();
  if (!db) return;
  const values = {
    ...(update.status === undefined ? {} : { status: update.status }),
    ...(update.progress === undefined ? {} : { progress: update.progress }),
    ...(update.currentStage === undefined ? {} : { currentStage: update.currentStage }),
    ...(update.attempt === undefined ? {} : { attempt: update.attempt }),
    ...(update.cancelRequested === undefined ? {} : { cancelRequested: update.cancelRequested ? 1 : 0 }),
    ...(update.resumeFromStage === undefined ? {} : { resumeFromStage: update.resumeFromStage }),
    ...(update.parentRunKey === undefined ? {} : { parentRunKey: update.parentRunKey }),
    ...(update.results === undefined ? {} : { resultMetadata: update.results ? JSON.stringify(update.results) : null }),
  };
  if (Object.keys(values).length) await db.update(testRuns).set(values).where(eq(testRuns.runKey, runId));
}

export async function requestTestRunCancellation(runId: string) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(testRuns).set({ cancelRequested: 1 }).where(inArray(testRuns.runKey, [runId]));
  return result[0].affectedRows > 0;
}

export async function getTestRunByKey(runId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(testRuns).where(eq(testRuns.runKey, runId)).limit(1);
  return result[0];
}

export async function getTestRunHistoryPage(limit = 10, offset = 0) {
  const db = await getDb();
  if (!db) return { rows: [], hasMore: false, nextOffset: offset };
  const rows = await db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(limit + 1).offset(offset);
  const hasMore = rows.length > limit;
  return { rows: hasMore ? rows.slice(0, limit) : rows, hasMore, nextOffset: hasMore ? offset + limit : null };
}

export async function getSuiteConfigurations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suiteConfigurations).orderBy(desc(suiteConfigurations.updatedAt)).limit(50);
}

export async function getTestRunHistory() {
  const page = await getTestRunHistoryPage(50, 0);
  return page.rows;
}

export async function getDashboardPersistence() {
  const db = await getDb();
  if (!db) return { metrics: [], runs: [], findings: [], audit: [] };
  const [metrics, runs, findings, audit] = await Promise.all([
    db.select().from(dashboardMetrics).orderBy(desc(dashboardMetrics.createdAt)).limit(20),
    db.select().from(testRuns).orderBy(desc(testRuns.createdAt)).limit(20),
    db.select().from(securityFindings).orderBy(desc(securityFindings.createdAt)).limit(20),
    db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(20),
  ]);
  return { metrics, runs, findings, audit };
}

export async function persistFinding(finding: { findingKey: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; category: string; component: string; status: string; expectedBehavior?: string; actualBehavior?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(securityFindings).values(finding);
}

export async function persistMetric(metricKey: string, value: string, delta: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(dashboardMetrics).values({ metricKey, value, delta }).onDuplicateKeyUpdate({ set: { value, delta } });
}

export async function persistSuiteConfiguration(suiteName: string, enabled: boolean, profile: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(suiteConfigurations).values({ suiteName, enabled: enabled ? 1 : 0, profile });
}

export async function persistAuditEvent(action: string, actorRole: "ADMIN" | "ANALYST" | "SYSTEM", metadata?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditEvents).values({ action, actorRole, metadata });
}

export type ReconciliationEvidenceInput = { evidenceKey: string; assetType: string; transactionHash: string; eventCount: number; expectedLedger: unknown; observedLedger: unknown; aligned: boolean; mismatches?: string[] };
export async function persistReconciliationEvidence(input: ReconciliationEvidenceInput) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reconciliationEvidence).values({ evidenceKey: input.evidenceKey, assetType: input.assetType, transactionHash: input.transactionHash, eventCount: input.eventCount, expectedLedger: JSON.stringify(input.expectedLedger), observedLedger: JSON.stringify(input.observedLedger), aligned: input.aligned ? 1 : 0, mismatches: input.mismatches?.length ? JSON.stringify(input.mismatches) : null });
}
export async function getReconciliationEvidence(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reconciliationEvidence).orderBy(desc(reconciliationEvidence.createdAt)).limit(limit);
}
