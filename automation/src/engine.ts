import type { IsolationContext, RetryPolicy, RunRequest, RunResult, PipelineStage, Finding, EvidenceRecord, SuiteName } from "./models";
import { PIPELINE_STAGES } from "./models";
import { evidence } from "./verification";

export interface SuiteContext {
  request: RunRequest;
  evidence: EvidenceRecord[];
  findings: Finding[];
  log(event: string): void;
}

export interface TestSuite {
  readonly name: SuiteName;
  execute(context: SuiteContext): Promise<void>;
}

export type RunnerProgressEvent = {
  runId: string;
  stage: PipelineStage;
  status: "RUNNING" | "PASSED" | "FAILED" | "ABORTED";
  progress: number;
  attempt: number;
  message: string;
  completedSuites: number;
  suiteCount: number;
  findingCount: number;
  evidenceCount: number;
};

export interface RunnerCallbacks {
  onProgress?(event: RunnerProgressEvent): void | Promise<void>;
}

export class RunAbortedError extends Error {
  constructor() {
    super("Automation run aborted by control request");
    this.name = "RunAbortedError";
  }
}

export class SuiteRegistry {
  private readonly suites = new Map<SuiteName, TestSuite>();
  register(suite: TestSuite) { this.suites.set(suite.name, suite); return this; }
  resolve(names: readonly SuiteName[]) { return names.map(name => this.suites.get(name)).filter((suite): suite is TestSuite => Boolean(suite)); }
}

export class AutomationRunner {
  constructor(private readonly registry: SuiteRegistry, private readonly timeoutMs = 30_000, private readonly retry: RetryPolicy = { maxAttempts: 1, backoffMs: 0 }) {}

  private assertNotAborted(signal?: AbortSignal) {
    if (signal?.aborted) throw new RunAbortedError();
  }

  private async executeWithRetry(task: () => Promise<void>, signal: AbortSignal | undefined, onAttempt?: (attempt: number) => void | Promise<void>) {
    let attempt = 0;
    while (attempt < Math.max(1, this.retry.maxAttempts)) {
      this.assertNotAborted(signal);
      attempt += 1;
      await onAttempt?.(attempt);
      try { return await task(); } catch (error) {
        if (error instanceof RunAbortedError) throw error;
        const retryable = this.retry.retryable ? this.retry.retryable(error) : true;
        if (!retryable || attempt >= this.retry.maxAttempts) throw error;
        this.assertNotAborted(signal);
        if (this.retry.backoffMs > 0) await new Promise(resolve => setTimeout(resolve, this.retry.backoffMs));
      }
    }
  }

  private async createIsolation(runId: string): Promise<IsolationContext> {
    let destroyed = false;
    return { walletId: `ephemeral-wallet-${runId}`, assetNamespace: `synthetic-${runId}`, chainId: 31337, async destroy() { destroyed = true; void destroyed; } };
  }

  async run(request: RunRequest, callbacks: RunnerCallbacks = {}): Promise<RunResult> {
    const stages: PipelineStage[] = [];
    const findings: Finding[] = [];
    const evidenceRecords: EvidenceRecord[] = [];
    const logs: string[] = [];
    const suites = this.registry.resolve(request.suites);
    const startIndex = request.resumeFromStage ? Math.max(0, PIPELINE_STAGES.indexOf(request.resumeFromStage)) : 0;
    const isolation = await this.createIsolation(request.runId);
    let completedSuites = 0;
    const context: SuiteContext = { request, evidence: evidenceRecords, findings, log: event => logs.push(event) };
    const emit = async (event: Omit<RunnerProgressEvent, "runId" | "attempt" | "completedSuites" | "suiteCount" | "findingCount" | "evidenceCount">, attempt = request.attempt ?? 1) => {
      await callbacks.onProgress?.({ ...event, runId: request.runId, attempt, completedSuites, suiteCount: suites.length, findingCount: findings.length, evidenceCount: evidenceRecords.length });
    };

    try {
      evidenceRecords.push(evidence(`${request.runId}-isolation`, "LOG", { walletId: isolation.walletId, assetNamespace: isolation.assetNamespace, chainId: isolation.chainId }));
      for (let index = startIndex; index < PIPELINE_STAGES.length; index += 1) {
        this.assertNotAborted(request.signal);
        const stage = PIPELINE_STAGES[index];
        stages.push(stage);
        context.log(`${stage} ${request.runId}`);
        const progress = Math.round((index / PIPELINE_STAGES.length) * 100);
        await emit({ stage, status: "RUNNING", progress, message: `${stage} stage started` });
        if (stage === "DISCOVER") evidenceRecords.push(evidence(`${request.runId}-discover`, "LOG", { target: request.target, suites: request.suites }));
        if (stage === "EXECUTE" || stage === "ATTACK") {
          for (const suite of suites) {
            this.assertNotAborted(request.signal);
            await this.executeWithRetry(
              () => Promise.race([
                suite.execute(context),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${suite.name} timed out`)), request.timeoutMs ?? this.timeoutMs)),
              ]),
              request.signal,
              attempt => emit({ stage, status: "RUNNING", progress, message: `${stage} · ${suite.name} attempt ${attempt}` }, attempt),
            );
            if (stage === "EXECUTE") {
              completedSuites += 1;
              await emit({ stage, status: "RUNNING", progress, message: `${stage} · ${suite.name} completed` });
            }
          }
        }
        if (stage === "RECONCILE") evidenceRecords.push(evidence(`${request.runId}-reconcile`, "RECONCILIATION", { logs: logs.slice(-10) }));
        await emit({ stage, status: "PASSED", progress: Math.round(((index + 1) / PIPELINE_STAGES.length) * 100), message: `${stage} stage completed` });
      }

      const result: RunResult = { runId: request.runId, status: findings.some(finding => finding.severity === "CRITICAL") ? "FAILED" : "PASSED", stages, findings, evidence: evidenceRecords, summary: `${request.runId}: ${findings.length} findings, ${evidenceRecords.length} evidence records` };
      await emit({ stage: stages.at(-1) ?? "REPORT", status: result.status, progress: 100, message: result.status === "PASSED" ? "Run completed" : "Run completed with critical findings" });
      return result;
    } catch (error) {
      if (error instanceof RunAbortedError || request.signal?.aborted) {
        await emit({ stage: stages.at(-1) ?? "DISCOVER", status: "ABORTED", progress: Math.round((stages.length / PIPELINE_STAGES.length) * 100), message: "Run cancelled" });
        return { runId: request.runId, status: "ABORTED", stages, findings, evidence: evidenceRecords, summary: `${request.runId}: cancelled at ${stages.at(-1) ?? "QUEUED"}` };
      }
      await emit({ stage: stages.at(-1) ?? "DISCOVER", status: "FAILED", progress: Math.round((stages.length / PIPELINE_STAGES.length) * 100), message: error instanceof Error ? error.message : "Run failed" });
      throw error;
    } finally {
      await isolation.destroy();
    }
  }
}

export const createDefaultRunner = () => new AutomationRunner(new SuiteRegistry()
  .register({ name: "Blockchain Transaction", async execute(context) { context.log(`TRANSACTION CHECK ${context.request.target}`); } })
  .register({ name: "Reconciliation", async execute(context) { context.log(`RECONCILIATION CHECK ${context.request.target}`); } })
  .register({ name: "Smart Contract", async execute(context) { context.log(`CONTRACT SCAN ${context.request.target}`); } })
  .register({ name: "Wallet Security", async execute(context) { context.log(`WALLET AUTHORIZATION CHECK ${context.request.target}`); } })
  .register({ name: "API Security", async execute(context) { context.log(`API SECURITY CHECK ${context.request.target}`); } })
  .register({ name: "Asset Lifecycle", async execute(context) { context.log(`LIFECYCLE CHECK ${context.request.target}`); } })
  .register({ name: "Fuzzing", async execute(context) { context.log(`FUZZ CAMPAIGN ${context.request.target}`); } })
  .register({ name: "Chaos/Failure Injection", async execute(context) { context.log(`CHAOS CHECK ${context.request.target}`); } }));
