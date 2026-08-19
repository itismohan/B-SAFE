import { z } from "zod";
import { compareLedgerMovements } from "../automation/src/reconciliation";
import { createDefaultRunner, type RunnerProgressEvent } from "../automation/src/engine";
import { PIPELINE_STAGES, type PipelineStage, type SuiteName } from "../automation/src/models";
import { getDashboardPersistence, getReconciliationEvidence, getTestRunByKey, getTestRunHistoryPage, persistAuditEvent, persistReconciliationEvidence, persistSuiteConfiguration, persistTestRun, requestTestRunCancellation, updateTestRun } from "./db";

export const severitySchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);
export const reportFormatSchema = z.enum(["HTML", "JSON", "JUnit", "SARIF"]);
export const reportRetentionSchema = z.object({ retentionDays: z.number().int().min(1).max(3650).default(30) });
export const reportDeletionSchema = z.object({ runId: z.string().min(1), format: reportFormatSchema });

export const suiteConfigInputSchema = z.object({ suiteName: z.string().min(1), enabled: z.boolean(), profile: z.enum(["critical-core", "full-regression", "adversarial"]) });
export const reconciliationEvidenceInputSchema = z.object({ evidenceKey: z.string().min(1), assetType: z.string().min(1), transactionHash: z.string().min(1), eventCount: z.number().int().nonnegative(), expectedLedger: z.unknown(), observedLedger: z.unknown(), aligned: z.boolean(), mismatches: z.array(z.string()).optional() });

export const testRunInputSchema = z.object({
  risk: severitySchema,
  parallel: z.boolean(),
  profile: z.enum(["critical-core", "full-regression", "adversarial"]),
});

export type TestRunInput = z.infer<typeof testRunInputSchema>;
export type TestRun = TestRunInput & {
  id: string;
  status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED";
  progress: number;
  currentStage: string;
  attempt: number;
  cancelRequested: boolean;
  resumeFromStage?: string | null;
  parentRunKey?: string | null;
  results?: ExecutionResults;
  createdAt: string;
  updatedAt?: string;
  isolation: { wallet: string; asset: string; chainId: number };
};

export type DashboardSnapshot = {
  score: number;
  metrics: { label: string; value: string; delta: string }[];
  runs: TestRun[];
  findings: { id: string; severity: z.infer<typeof severitySchema>; category: string; component: string; status: string }[];
  audit: { time: string; action: string; actor: "ADMIN" | "ANALYST" | "SYSTEM"; metadata?: { source?: string; format?: string; generatedAt?: string; artifactPath?: string; artifactKey?: string; artifactUrl?: string; runId?: string; findingCount?: number; retentionDays?: number; expiresAt?: string; deletedAt?: string } }[];
};

export type ExecutionResults = { suites: string; gates: string; findings: string; evidence: string };
export type ExecutionEvent = { time: string; runId?: string; level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"; message: string; hash?: string; block?: string; status?: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED" | "BLOCKED"; progress?: number; results?: ExecutionResults; stage?: string; attempt?: number };
const executionEvents: ExecutionEvent[] = [
  { time: "2026-08-18T10:42:18.221Z", level: "INFO", message: "TEST RUN STARTED · run_8f42c1 · isolated execution context", status: "RUNNING" },
  { time: "2026-08-18T10:42:19.003Z", level: "INFO", message: "SYNTHETIC ASSET REGISTERED · ASSET-10291 · supply 1,000" },
  { time: "2026-08-18T10:42:20.119Z", level: "INFO", message: "TRANSACTION SUBMITTED · chain 31337 · gas estimate 142,880", hash: "0x7b91…e4c2" },
  { time: "2026-08-18T10:42:21.907Z", level: "INFO", message: "TRANSACTION CONFIRMED · block 19,421 · 2 confirmations", hash: "0x7b91…e4c2", block: "19,421" },
  { time: "2026-08-18T10:42:22.431Z", level: "HIGH", message: "ATTACK SCENARIO · unauthorized transfer attempt blocked", status: "BLOCKED" },
  { time: "2026-08-18T10:42:23.005Z", level: "INFO", message: "LEDGER RECONCILIATION PASSED · 5/5 layers aligned", status: "PASSED" },
];
const listeners = new Set<(event: ExecutionEvent) => void>();
export const getExecutionEvents = () => [...executionEvents];
export const subscribeExecution = (listener: (event: ExecutionEvent) => void) => { listeners.add(listener); return () => listeners.delete(listener); };
const runner = createDefaultRunner();
const controllers = new Map<string, AbortController>();
const updateRunExecution = (runId: string, update: { status?: TestRun["status"]; progress?: number; currentStage?: string; attempt?: number; cancelRequested?: boolean; resumeFromStage?: string | null; results?: ExecutionResults }) => {
  const run = runs.find(candidate => candidate.id === runId);
  if (run) {
    if (update.status !== undefined) run.status = update.status;
    if (update.progress !== undefined) run.progress = update.progress;
    if (update.currentStage !== undefined) run.currentStage = update.currentStage;
    if (update.attempt !== undefined) run.attempt = update.attempt;
    if (update.cancelRequested !== undefined) run.cancelRequested = update.cancelRequested;
    if (update.resumeFromStage !== undefined) run.resumeFromStage = update.resumeFromStage;
    if (update.results !== undefined) run.results = update.results;
  }
  void updateTestRun(runId, update).catch(error => console.warn("[Dashboard] Could not update test run", error));
};
export const publishExecution = (event: Omit<ExecutionEvent, "time">) => { const next = { ...event, time: new Date().toISOString() }; executionEvents.push(next); if (executionEvents.length > 100) executionEvents.shift(); listeners.forEach(listener => listener(next)); return next; };

const runs: TestRun[] = [];
const audit: DashboardSnapshot["audit"] = [
  { time: "10:42:23", action: "Test run evidence package sealed", actor: "ANALYST" },
  { time: "10:41:56", action: "Reconciliation policy inspected", actor: "ANALYST" },
  { time: "10:39:02", action: "Session established with MFA", actor: "SYSTEM" },
];

const defaultSuites: SuiteName[] = ["Smart Contract", "Blockchain Transaction", "Wallet Security", "API Security", "Asset Lifecycle", "Reconciliation", "Fuzzing", "Chaos/Failure Injection"];
const resultsFromProgress = (event: RunnerProgressEvent): ExecutionResults => ({ suites: `${String(event.completedSuites).padStart(2, "0")} / ${String(event.suiteCount).padStart(2, "0")}`, gates: `${String(Math.min(5, Math.floor(event.progress / 20))).padStart(2, "0")} / 05`, findings: String(event.findingCount).padStart(2, "0"), evidence: event.status === "PASSED" && event.progress === 100 ? "SEALED" : event.status === "ABORTED" ? "PARTIAL" : "OPEN" });
const executeRun = async (run: TestRun, resumeFromStage?: PipelineStage) => {
  const controller = new AbortController();
  if (run.cancelRequested) controller.abort();
  controllers.set(run.id, controller);
  updateRunExecution(run.id, { status: controller.signal.aborted ? "CANCELLED" : "RUNNING", progress: run.progress, currentStage: resumeFromStage ?? run.currentStage, cancelRequested: controller.signal.aborted, resumeFromStage: resumeFromStage ?? null });
  publishExecution({ runId: run.id, level: "INFO", message: `${resumeFromStage ? "RUN RESUMED" : "RUN STARTED"} · ${run.id} · attempt ${run.attempt}`, status: "RUNNING", progress: run.progress, stage: resumeFromStage ?? run.currentStage, attempt: run.attempt });
  try {
    const result = await runner.run({ runId: run.id, risk: run.risk, suites: defaultSuites, target: run.profile, attempt: run.attempt, resumeFromStage, signal: controller.signal }, {
      onProgress: event => {
        const results = resultsFromProgress(event);
        const status = event.status === "ABORTED" ? "CANCELLED" : event.status === "FAILED" ? "FAILED" : event.progress === 100 && event.stage === "REPORT" ? "PASSED" : "RUNNING";
        updateRunExecution(run.id, { status, progress: event.progress, currentStage: event.stage, attempt: event.attempt, results });
        publishExecution({ runId: run.id, level: status === "FAILED" ? "HIGH" : "INFO", message: `${event.message} · ${run.id}`, status, progress: event.progress, results, stage: event.stage, attempt: event.attempt });
      },
    });
    if (result.status === "ABORTED") updateRunExecution(run.id, { status: "CANCELLED", currentStage: run.currentStage, cancelRequested: false });
    else updateRunExecution(run.id, { status: result.status, progress: 100, currentStage: "REPORT", cancelRequested: false, results: { suites: `${String(defaultSuites.length).padStart(2, "0")} / ${String(defaultSuites.length).padStart(2, "0")}`, gates: "05 / 05", findings: String(result.findings.length).padStart(2, "0"), evidence: "SEALED" } });
    return result;
  } catch (error) {
    updateRunExecution(run.id, { status: "FAILED", currentStage: run.currentStage, cancelRequested: false, results: { suites: "00 / 08", gates: "00 / 05", findings: "00", evidence: "OPEN" } });
    publishExecution({ runId: run.id, level: "HIGH", message: `${run.id} failed · ${error instanceof Error ? error.message : "unknown error"}`, status: "FAILED", progress: run.progress, stage: run.currentStage, attempt: run.attempt });
    throw error;
  } finally {
    controllers.delete(run.id);
  }
};

export const dashboardSnapshot = async (): Promise<DashboardSnapshot> => {
  const stored = await getDashboardPersistence();
  return {
  score: 96,
  metrics: stored.metrics.length ? stored.metrics.map(metric => ({ label: metric.metricKey, value: metric.value, delta: metric.delta })) : [
    { label: "Tests executed", value: "1,284", delta: "+18.6%" },
    { label: "Tests passed", value: "1,241", delta: "+12.4%" },
    { label: "Tests failed", value: "43", delta: "-4.8%" },
    { label: "Transactions tested", value: "5,906", delta: "+22.1%" },
    { label: "Avg. confirmation", value: "1.84s", delta: "-0.22s" },
    { label: "Reconciliation mismatches", value: "0", delta: "Stable" },
  ],
  runs: stored.runs.length ? stored.runs.map(run => ({ id: run.runKey, risk: run.risk, parallel: Boolean(run.parallel), profile: run.profile as TestRun["profile"], status: run.status, progress: run.progress ?? 0, currentStage: run.currentStage ?? "QUEUED", attempt: run.attempt ?? 1, cancelRequested: Boolean(run.cancelRequested), resumeFromStage: run.resumeFromStage, parentRunKey: run.parentRunKey, results: (() => { try { return run.resultMetadata ? JSON.parse(run.resultMetadata) as ExecutionResults : undefined; } catch { return undefined; } })(), createdAt: run.createdAt.toISOString(), updatedAt: run.updatedAt?.toISOString(), isolation: { wallet: run.isolationWallet, asset: run.isolationAsset, chainId: run.chainId } })) : [...runs],
  findings: stored.findings.length ? stored.findings.map(finding => ({ id: finding.findingKey, severity: finding.severity, category: finding.category, component: finding.component, status: finding.status })) : [
    { id: "FND-0042", severity: "HIGH", category: "Authorization", component: "TransferController", status: "OPEN" },
    { id: "FND-0041", severity: "MEDIUM", category: "Oracle integrity", component: "ValuationOracle", status: "REVIEW" },
    { id: "FND-0039", severity: "LOW", category: "API hardening", component: "Portfolio API", status: "ACCEPTED" },
  ],
  audit: stored.audit.length ? stored.audit.map(event => ({ time: event.createdAt.toISOString().slice(11, 19), action: event.action, actor: event.actorRole, metadata: (() => { try { return event.metadata ? JSON.parse(event.metadata) : undefined; } catch { return undefined; } })() })).filter(event => { const metadata = event.metadata; if (event.action.endsWith(" deleted")) return true; if (!metadata?.format || !metadata.runId) return true; return !stored.audit.some(tombstone => tombstone.action === `Report ${metadata.runId}/${metadata.format} deleted`); }) : [...audit],
  };
};

export const createTestRun = (input: TestRunInput): TestRun => {
  const run: TestRun = {
    ...input,
    id: `run_${Math.random().toString(16).slice(2, 8)}`,
    status: "QUEUED",
    createdAt: new Date().toISOString(),
    progress: 0,
    currentStage: "QUEUED",
    attempt: 1,
    cancelRequested: false,
    resumeFromStage: null,
    parentRunKey: null,
    results: undefined,
    isolation: { wallet: `wallet_${Math.random().toString(16).slice(2, 6)}`, asset: `asset_${Math.random().toString(16).slice(2, 6)}`, chainId: 31337 },
  };
  runs.unshift(run);
  audit.unshift({ time: new Date().toISOString().slice(11, 19), action: `Test run ${run.id} queued at ${input.risk} risk`, actor: "ANALYST" });
  void persistTestRun(run).catch(error => console.warn("[Dashboard] Could not persist test run", error));
  void persistAuditEvent(`Test run ${run.id} queued at ${input.risk} risk`, "ANALYST").catch(error => console.warn("[Dashboard] Could not persist audit event", error));
  publishExecution({ runId: run.id, level: "INFO", message: `TEST RUN QUEUED · ${run.id} · risk ${input.risk} · parallel ${input.parallel ? "enabled" : "disabled"}`, status: "QUEUED", progress: 0, stage: "QUEUED", attempt: run.attempt });
  publishExecution({ runId: run.id, level: "INFO", message: `EPHEMERAL WALLET CREATED · ${run.isolation.wallet} · chain 31337` });
  void Promise.resolve().then(() => executeRun(run)).catch(error => console.warn("[Dashboard] Runner execution failed", error));
  return { ...run, isolation: { ...run.isolation } };
};

const resetForExecution = (run: TestRun, mode: "RETRY" | "RESUME") => {
  run.attempt += 1;
  run.status = "QUEUED";
  run.progress = mode === "RESUME" ? run.progress : 0;
  run.cancelRequested = false;
  run.resumeFromStage = mode === "RESUME" ? (PIPELINE_STAGES[PIPELINE_STAGES.indexOf(run.currentStage as PipelineStage) + 1] ?? "DISCOVER") : null;
  void updateTestRun(run.id, { status: run.status, progress: run.progress, currentStage: run.currentStage, attempt: run.attempt, cancelRequested: false, resumeFromStage: run.resumeFromStage }).catch(error => console.warn("[Dashboard] Could not reset test run", error));
  publishExecution({ runId: run.id, level: "INFO", message: `${mode} REQUESTED · ${run.id} · attempt ${run.attempt}`, status: "QUEUED", progress: run.progress, stage: run.resumeFromStage ?? "DISCOVER", attempt: run.attempt });
  void executeRun(run, run.resumeFromStage as PipelineStage | undefined).catch(error => console.warn("[Dashboard] Controlled retry/resume failed", error));
  return run;
};

export const cancelTestRun = async (runId: string) => {
  const run = runs.find(candidate => candidate.id === runId);
  if (run) { run.cancelRequested = true; updateRunExecution(runId, { cancelRequested: true }); }
  await requestTestRunCancellation(runId);
  controllers.get(runId)?.abort();
  publishExecution({ runId, level: "HIGH", message: `CANCEL REQUESTED · ${runId}`, status: "CANCELLED", progress: run?.progress ?? 0, stage: run?.currentStage });
  return { runId, status: "CANCEL_REQUESTED" as const };
};

const loadControlledRun = async (runId: string) => {
  const existing = runs.find(candidate => candidate.id === runId);
  if (existing) return existing;
  const stored = await runDetail(runId);
  if (!stored) return undefined;
  runs.unshift(stored);
  return stored;
};

export const retryTestRun = async (runId: string) => {
  const run = await loadControlledRun(runId);
  if (!run) throw new Error(`Run ${runId} is not available in the active control plane`);
  if (!["FAILED", "CANCELLED"].includes(run.status)) throw new Error("Only failed or cancelled runs can be retried");
  return resetForExecution(run, "RETRY");
};

export const resumeTestRun = async (runId: string) => {
  const run = await loadControlledRun(runId);
  if (!run) throw new Error(`Run ${runId} is not available in the active control plane`);
  if (!["FAILED", "CANCELLED"].includes(run.status)) throw new Error("Only failed or cancelled runs can be resumed");
  return resetForExecution(run, "RESUME");
};

export const runDetail = async (runId: string) => {
  const run = runs.find(candidate => candidate.id === runId);
  if (run) return run;
  const stored = await getTestRunByKey(runId);
  if (!stored) return undefined;
  return { id: stored.runKey, risk: stored.risk, parallel: Boolean(stored.parallel), profile: stored.profile as TestRun["profile"], status: stored.status, progress: stored.progress, currentStage: stored.currentStage, attempt: stored.attempt, cancelRequested: Boolean(stored.cancelRequested), resumeFromStage: stored.resumeFromStage, parentRunKey: stored.parentRunKey, results: stored.resultMetadata ? JSON.parse(stored.resultMetadata) as ExecutionResults : undefined, createdAt: stored.createdAt.toISOString(), updatedAt: stored.updatedAt.toISOString(), isolation: { wallet: stored.isolationWallet, asset: stored.isolationAsset, chainId: stored.chainId } } satisfies TestRun;
};

export const runHistoryPage = async (limit: number, offset: number) => {
  const page = await getTestRunHistoryPage(limit, offset);
  if (page.rows.length === 0 && runs.length > 0) {
    const rows = runs.slice(offset, offset + limit);
    return { rows, hasMore: offset + limit < runs.length, nextOffset: offset + limit < runs.length ? offset + limit : null };
  }
  return { ...page, rows: page.rows.map(row => ({ id: row.runKey, risk: row.risk, parallel: Boolean(row.parallel), profile: row.profile as TestRun["profile"], status: row.status, progress: row.progress, currentStage: row.currentStage, attempt: row.attempt, cancelRequested: Boolean(row.cancelRequested), resumeFromStage: row.resumeFromStage, parentRunKey: row.parentRunKey, results: row.resultMetadata ? JSON.parse(row.resultMetadata) as ExecutionResults : undefined, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), isolation: { wallet: row.isolationWallet, asset: row.isolationAsset, chainId: row.chainId } })) };
};

export const configureSuite = (input: z.infer<typeof suiteConfigInputSchema>) => {
  void persistSuiteConfiguration(input.suiteName, input.enabled, input.profile).catch(error => console.warn("[Dashboard] Could not persist suite configuration", error));
  void persistAuditEvent(`Suite ${input.suiteName} ${input.enabled ? "enabled" : "disabled"}`, "ANALYST", input.profile).catch(error => console.warn("[Dashboard] Could not persist suite audit", error));
  publishExecution({ level: "INFO", message: `SUITE CONFIGURED · ${input.suiteName} · ${input.enabled ? "enabled" : "disabled"}` });
  return { ...input, status: "SAVED" as const };
};

export const persistReconciliation = async (input: z.infer<typeof reconciliationEvidenceInputSchema>) => {
  const compared = compareLedgerMovements((input.expectedLedger ?? []) as never[], (input.observedLedger ?? []) as never[]);
  const result = { ...input, aligned: compared.aligned, mismatches: compared.mismatches };
  await persistReconciliationEvidence(result);
  await persistAuditEvent(`Reconciliation evidence ${input.evidenceKey} ${result.aligned ? "aligned" : "mismatch"}`, "SYSTEM", input.assetType);
  publishExecution({ level: result.aligned ? "INFO" : "HIGH", message: `LEDGER RECONCILIATION ${result.aligned ? "PASSED" : "MISMATCH"} · ${input.evidenceKey}`, status: result.aligned ? "PASSED" : "FAILED" });
  return { ...result, status: result.aligned ? "ALIGNED" as const : "MISMATCH" as const };
};

export const reconciliationEvidence = (limit = 50) => getReconciliationEvidence(limit);

export const deleteReportHistory = async (input: z.infer<typeof reportDeletionSchema>) => {
  const deletedAt = new Date().toISOString();
  await persistAuditEvent(`Report ${input.runId}/${input.format} deleted`, "ADMIN", JSON.stringify({ runId: input.runId, format: input.format, deletedAt, reason: "RETENTION_CONTROL" }));
  publishExecution({ level: "INFO", message: `REPORT HISTORY DELETED · ${input.runId} · ${input.format}`, status: "PASSED" });
  return { ...input, deletedAt, status: "DELETED" as const };
};

export const pruneReportHistory = async (input: z.infer<typeof reportRetentionSchema>) => {
  const stored = await getDashboardPersistence();
  const cutoff = Date.now() - input.retentionDays * 24 * 60 * 60 * 1000;
  const candidates = stored.audit.flatMap(event => { try { const metadata = event.metadata ? JSON.parse(event.metadata) : undefined; if (!metadata?.runId || !metadata.format || !metadata.generatedAt || Date.parse(metadata.generatedAt) >= cutoff) return []; return [{ runId: metadata.runId as string, format: metadata.format as z.infer<typeof reportFormatSchema> }]; } catch { return []; } });
  const unique = Array.from(new Map(candidates.map(candidate => [`${candidate.runId}/${candidate.format}`, candidate])).values());
  for (const candidate of unique) await deleteReportHistory(candidate);
  return { retentionDays: input.retentionDays, deleted: unique.length, status: "PRUNED" as const };
};

export const requestReport = (format: z.infer<typeof reportFormatSchema>) => {
  audit.unshift({ time: new Date().toISOString().slice(11, 19), action: `${format} evidence report requested`, actor: "ANALYST" });
  void persistAuditEvent(`${format} evidence report requested`, "ANALYST").catch(error => console.warn("[Dashboard] Could not persist audit event", error));
  publishExecution({ level: "INFO", message: `REPORT EXPORT QUEUED · format ${format} · evidence package`, status: "QUEUED" });
  return { format, status: "QUEUED" as const };
};
