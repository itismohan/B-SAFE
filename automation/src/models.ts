export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const LIFECYCLE_STAGES = ["Creation", "Registration", "Tokenization", "Ownership", "Transfer", "Settlement", "Custody", "Valuation", "Redemption", "Burn"] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const PIPELINE_STAGES = ["DISCOVER", "MODEL", "GENERATE", "EXECUTE", "OBSERVE", "VERIFY", "ATTACK", "RECONCILE", "ANALYZE", "REPORT"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export type SuiteName =
  | "Smart Contract"
  | "Blockchain Transaction"
  | "Wallet Security"
  | "API Security"
  | "Asset Lifecycle"
  | "Reconciliation"
  | "Fuzzing"
  | "Chaos/Failure Injection";

export interface RunRequest {
  runId: string;
  risk: Severity;
  suites: SuiteName[];
  target: string;
  timeoutMs?: number;
  attempt?: number;
  resumeFromStage?: PipelineStage;
  signal?: AbortSignal;
}

export interface TransactionObservation {
  sender: string;
  recipient: string;
  nonce: number;
  value: string;
  gasUsed?: string;
  gasPrice?: string;
  chainId: number;
  hash: string;
  signatureValid: boolean;
  blockNumber?: number;
  blockHash?: string;
  status: "CONFIRMED" | "REVERTED" | "PENDING";
  events: readonly string[];
}

export interface BusinessValidityInput {
  transactionValid: boolean;
  signatureValid: boolean;
  authorizationValid: boolean;
  assetStateValid: boolean;
  contractStateValid: boolean;
  ledgerStateValid: boolean;
  businessRulesValid: boolean;
  reconciliationValid: boolean;
}

export interface ThreatActor { id: string; name: string; capability: string; }
export interface AttackSurface { id: string; name: string; component: string; }
export interface ThreatScenario { id: string; threat: string; actor: ThreatActor; surface: AttackSurface; likelihood: Severity; impact: Severity; preventiveControl: string; detectionControl: string; }
export interface ThreatModel { id: string; actors: ThreatActor[]; surfaces: AttackSurface[]; scenarios: ThreatScenario[]; }
export interface TestCase { id: string; name: string; suite: SuiteName; preconditions: string[]; steps: string[]; expectedResult: string; severity: Severity; }

export interface RetryPolicy { maxAttempts: number; backoffMs: number; retryable?: (error: unknown) => boolean; }
export interface IsolationContext { walletId: string; assetNamespace: string; chainId: number; destroy(): Promise<void>; }

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  component: string;
  scenario: string;
  expected: string;
  actual: string;
  evidenceIds: string[];
  remediation: string;
  locations?: { uri: string; startLine?: number; startColumn?: number }[];
}

export interface EvidenceRecord {
  id: string;
  kind: "TRANSACTION" | "RECEIPT" | "CRYPTOGRAPHIC" | "AUTHORIZATION" | "LEDGER" | "RECONCILIATION" | "LOG";
  capturedAt: string;
  payload: Record<string, unknown>;
  redacted: boolean;
}

export interface ReconciliationResult {
  aligned: boolean;
  layers: Record<"Blockchain" | "Smart Contract" | "Application DB" | "Asset Ledger" | "Reporting System", "ALIGNED" | "MISMATCH">;
  mismatches: string[];
}

export interface RunResult {
  runId: string;
  status: "PASSED" | "FAILED" | "ABORTED";
  stages: PipelineStage[];
  findings: Finding[];
  evidence: EvidenceRecord[];
  reconciliation?: ReconciliationResult;
  summary: string;
}

export const isBusinessValidTransaction = (input: BusinessValidityInput): boolean =>
  Object.values(input).every(Boolean);
