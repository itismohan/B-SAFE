import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const testRuns = mysqlTable("test_runs", {
  id: int("id").autoincrement().primaryKey(),
  runKey: varchar("runKey", { length: 32 }).notNull().unique(),
  risk: mysqlEnum("risk", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]).notNull(),
  profile: varchar("profile", { length: 64 }).notNull(),
  parallel: int("parallel").notNull().default(1),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "PASSED", "FAILED", "CANCELLED"]).notNull().default("QUEUED"),
  progress: int("progress").notNull().default(0),
  currentStage: varchar("currentStage", { length: 32 }).notNull().default("QUEUED"),
  attempt: int("attempt").notNull().default(1),
  cancelRequested: int("cancelRequested").notNull().default(0),
  resumeFromStage: varchar("resumeFromStage", { length: 32 }),
  parentRunKey: varchar("parentRunKey", { length: 32 }),
  resultMetadata: text("resultMetadata"),
  isolationWallet: varchar("isolationWallet", { length: 64 }).notNull(),
  isolationAsset: varchar("isolationAsset", { length: 64 }).notNull(),
  chainId: int("chainId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const securityFindings = mysqlTable("security_findings", {
  id: int("id").autoincrement().primaryKey(),
  findingKey: varchar("findingKey", { length: 32 }).notNull().unique(),
  severity: mysqlEnum("severity", ["CRITICAL", "HIGH", "MEDIUM", "LOW"]).notNull(),
  category: varchar("category", { length: 128 }).notNull(),
  component: varchar("component", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  expectedBehavior: text("expectedBehavior"),
  actualBehavior: text("actualBehavior"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const dashboardMetrics = mysqlTable("dashboard_metrics", {
  id: int("id").autoincrement().primaryKey(),
  metricKey: varchar("metricKey", { length: 64 }).notNull().unique(),
  value: varchar("value", { length: 64 }).notNull(),
  delta: varchar("delta", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const suiteConfigurations = mysqlTable("suite_configurations", {
  id: int("id").autoincrement().primaryKey(),
  suiteName: varchar("suiteName", { length: 128 }).notNull(),
  enabled: int("enabled").notNull().default(1),
  profile: varchar("profile", { length: 64 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  actorRole: mysqlEnum("actorRole", ["ADMIN", "ANALYST", "SYSTEM"]).notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});


export const reconciliationEvidence = mysqlTable("reconciliation_evidence", {
  id: int("id").autoincrement().primaryKey(),
  evidenceKey: varchar("evidenceKey", { length: 64 }).notNull().unique(),
  assetType: varchar("assetType", { length: 32 }).notNull(),
  transactionHash: varchar("transactionHash", { length: 80 }).notNull(),
  eventCount: int("eventCount").notNull(),
  expectedLedger: text("expectedLedger").notNull(),
  observedLedger: text("observedLedger").notNull(),
  aligned: int("aligned").notNull().default(1),
  mismatches: text("mismatches"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
