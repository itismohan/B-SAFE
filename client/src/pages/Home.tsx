import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Blocks,
  Bot,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Command,
  Database,
  Download,
  FileCheck2,
  Filter,
  Fingerprint,
  FlaskConical,
  Gauge,
  GitBranch,
  KeyRound,
  Layers3,
  LockKeyhole,
  Play,
  Plus,
  Radar,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  WalletCards,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const severityOrder = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
type Severity = (typeof severityOrder)[number];
type RunStatus = "IDLE" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
type RunResults = { suites: string; gates: string; findings: string; evidence: string };
type DashboardRun = { id: string; risk: Severity; profile: string; status: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED"; progress: number; currentStage: string; attempt: number; cancelRequested: boolean; resumeFromStage?: string | null; results?: RunResults; createdAt: string; updatedAt?: string; isolation: { wallet: string; asset: string; chainId: number } };

type LogEvent = { time: string; level: Severity | "INFO"; message: string; hash?: string; block?: string };

const initialLogs: LogEvent[] = [
  { time: "10:42:18.221", level: "INFO", message: "TEST RUN STARTED · run_8f42c1 · isolated execution context" },
  { time: "10:42:18.438", level: "INFO", message: "EPHEMERAL WALLET CREATED · wallet_02A7 · nonce baseline 0" },
  { time: "10:42:19.003", level: "INFO", message: "SYNTHETIC ASSET REGISTERED · ASSET-10291 · supply 1,000" },
  { time: "10:42:20.119", level: "INFO", message: "TRANSACTION SUBMITTED · chain 31337 · gas estimate 142,880", hash: "0x7b91…e4c2" },
  { time: "10:42:21.907", level: "INFO", message: "TRANSACTION CONFIRMED · block 19,421 · 2 confirmations", hash: "0x7b91…e4c2", block: "19,421" },
  { time: "10:42:22.102", level: "INFO", message: "SMART CONTRACT STATE VERIFIED · ownershipOf(ASSET-10291)" },
  { time: "10:42:22.431", level: "HIGH", message: "ATTACK SCENARIO · unauthorized transfer attempt blocked" },
  { time: "10:42:23.005", level: "INFO", message: "LEDGER RECONCILIATION PASSED · 5/5 layers aligned" },
  { time: "10:42:23.318", level: "MEDIUM", message: "FUZZ CASE RETAINED · boundary amount: 0.00000001" },
];

const suites = [
  ["Smart Contract", Code2, "18 / 18", "PASS", "Contract invariants, events, access control", "98%"],
  ["Blockchain Transaction", Blocks, "24 / 26", "RUNNING", "Receipt, nonce, chain ID, gas, finality", "82%"],
  ["Wallet Security", WalletCards, "12 / 12", "PASS", "Signing, rotation, replay protection", "100%"],
  ["API Security", Radar, "31 / 34", "WARN", "JWT, BOLA, mutation, rate limits", "91%"],
  ["Asset Lifecycle", Layers3, "10 / 10", "PASS", "Creation through Burn state transitions", "100%"],
  ["Reconciliation", RefreshCcw, "5 / 5", "PASS", "Cross-layer balance and ownership proof", "100%"],
  ["Fuzzing", FlaskConical, "43 / 48", "RUNNING", "Stateful, boundary, mutation inputs", "76%"],
  ["Chaos / Failure Injection", Activity, "8 / 9", "WARN", "RPC, queue, reorg, timeout scenarios", "88%"],
] as const;

const runProfiles = [
  { value: "critical-core", label: "CRITICAL CORE FLOWS", scope: "Authorization, state integrity, transfer, and reconciliation gates.", modules: 8, duration: "~ 04 MIN", color: "critical" },
  { value: "full-regression", label: "FULL REGRESSION", scope: "Complete asset lifecycle, API, wallet, fuzz, and chaos coverage.", modules: 8, duration: "~ 12 MIN", color: "regression" },
  { value: "adversarial", label: "ADVERSARIAL + CHAOS", scope: "Attack-path simulation with failure injection and recovery checks.", modules: 6, duration: "~ 08 MIN", color: "adversarial" },
] as const;

type RunProfile = (typeof runProfiles)[number]["value"];

const metricCards = [
  { label: "Tests executed", value: "1,284", delta: "+18.6%", icon: FlaskConical, tone: "cyan" },
  { label: "Tests passed", value: "1,241", delta: "+12.4%", icon: Check, tone: "green" },
  { label: "Tests failed", value: "43", delta: "-4.8%", icon: XCircle, tone: "amber" },
  { label: "Transactions tested", value: "5,906", delta: "+22.1%", icon: Blocks, tone: "blue" },
  { label: "Avg. confirmation", value: "1.84s", delta: "-0.22s", icon: Clock3, tone: "violet" },
  { label: "Reconciliation mismatches", value: "0", delta: "Stable", icon: FileCheck2, tone: "green" },
];

const findingRows = [
  { id: "FND-0042", severity: "HIGH" as Severity, category: "Authorization", component: "TransferController", asset: "ASSET-10291", status: "OPEN" },
  { id: "FND-0041", severity: "MEDIUM" as Severity, category: "Oracle integrity", component: "ValuationOracle", asset: "ASSET-10288", status: "REVIEW" },
  { id: "FND-0039", severity: "LOW" as Severity, category: "API hardening", component: "Portfolio API", asset: "—", status: "ACCEPTED" },
];

function artifactHref(artifactPath?: string, artifactKey?: string, artifactUrl?: string) {
  if (artifactKey) return `/api/reports/signed?key=${encodeURIComponent(artifactKey)}`;
  if (artifactUrl) return artifactUrl;
  if (!artifactPath) return undefined;
  if (/^https?:\/\//.test(artifactPath) || artifactPath.startsWith("/")) return artifactPath;
  return `/api/reports/${artifactPath.split("/").pop()}`;
}

function severityClass(level: string) {
  return {
    CRITICAL: "severity-critical",
    HIGH: "severity-high",
    MEDIUM: "severity-medium",
    LOW: "severity-low",
    INFO: "severity-info",
  }[level] ?? "severity-info";
}

function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ card }: { card: (typeof metricCards)[number] }) {
  const Icon = card.icon;
  return (
    <div className="metric-card blueprint-card">
      <div className={cn("metric-icon", `metric-${card.tone}`)}><Icon size={16} /></div>
      <div className="metric-copy"><span>{card.label}</span><strong>{card.value}</strong><small className={card.delta.startsWith("-") ? "delta-down" : "delta-up"}>{card.delta} <ArrowUpRight size={11} /></small></div>
    </div>
  );
}

function DedicatedView({
  activeNav,
  displayFindings,
  reportAudit,
  onNewRun,
  onConfigure,
  onOpenHistory,
  runStatus,
  runProgress,
  lastRunId,
  runError,
  runLaunching,
  runResults,
  historyRuns,
  historyHasMore,
  historyOffset,
  selectedRun,
  onSelectRun,
  onHistoryNext,
  onHistoryPrevious,
  onCancelRun,
  onRetryRun,
  onResumeRun,
}: {
  activeNav: string;
  displayFindings: Array<{ id: string; severity: Severity; category: string; component: string; asset?: string; status: string }>;
  reportAudit: Array<{ time: string; action: string; actor: string; metadata?: { format?: string; source?: string; runId?: string; findingCount?: number; expiresAt?: string; artifactPath?: string } | null }>;
  onNewRun: () => void;
  onConfigure: () => void;
  onOpenHistory: () => void;
  runStatus: RunStatus;
  runProgress: number;
  lastRunId: string;
  runError: string | null;
  runLaunching: boolean;
  runResults: RunResults;
  historyRuns: DashboardRun[];
  historyHasMore: boolean;
  historyOffset: number;
  selectedRun?: DashboardRun;
  onSelectRun: (run: DashboardRun) => void;
  onHistoryNext: () => void;
  onHistoryPrevious: () => void;
  onCancelRun: (runId: string) => void;
  onRetryRun: (runId: string) => void;
  onResumeRun: (runId: string) => void;
}) {
  const viewMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
    "Test runs": { eyebrow: "02 / RUN CONTROL", title: "Test runs", description: "Review isolated executions, risk posture, and evidence readiness across the control plane." },
    "Test engine": { eyebrow: "03 / EXECUTION MODULES", title: "Test engine", description: "Configure and inspect the modular security suites that compose each B-SAFE run." },
    Findings: { eyebrow: "06 / SECURITY FINDINGS", title: "Findings", description: "Triage security findings with severity, ownership, status, and remediation context." },
    Reconciliation: { eyebrow: "07 / INDEPENDENT ORACLES", title: "Reconciliation", description: "Compare blockchain, contract, application, ledger, and reporting state independently." },
    "Evidence & reports": { eyebrow: "08 / EVIDENCE CONTROL", title: "Evidence & reports", description: "Inspect retained CI evidence, report formats, artifact access, and audit provenance." },
  };
  const meta = viewMeta[activeNav] ?? viewMeta["Test runs"];

  return (
    <section className="dedicated-view">
      <div className="dedicated-hero blueprint-card">
        <div><div className="eyebrow">{meta.eyebrow}</div><h1>{meta.title}</h1><p>{meta.description}</p></div>
        <div className="dedicated-actions"><span className="sync-ok"><CircleDot size={12} /> VIEW ACTIVE</span>{activeNav === "Test runs" && <Button className="launch-button critical-cta" onClick={onNewRun} disabled={runLaunching}><Plus size={14} /> {runLaunching ? "QUEUING CRITICAL RUN" : "LAUNCH CRITICAL RUN"}</Button>}{activeNav === "Test engine" && <Button variant="outline" onClick={onConfigure}><Settings2 size={14} /> CONFIGURE SUITES</Button>}{activeNav === "Evidence & reports" && <Button variant="outline" onClick={onOpenHistory}><Clock3 size={14} /> VIEW HISTORY</Button>}</div>
      </div>

      {activeNav === "Test runs" && <>
        <section className="blueprint-card execution-results-panel"><div className="execution-results-header"><div><div className="eyebrow">CRITICAL RUN / EXECUTION RESULTS</div><h2>{runStatus === "QUEUED" ? "Critical run queued" : runStatus === "RUNNING" ? "Critical run in progress" : runStatus === "COMPLETED" ? "Critical run completed" : runStatus === "FAILED" ? "Critical run failed" : runStatus === "CANCELLED" ? "Critical run cancelled" : "Ready to launch a critical run"}</h2><p>Run <strong>{lastRunId}</strong> · isolated Hardhat fork · critical security gates enabled</p></div><span className={cn("execution-state", runStatus === "COMPLETED" ? "state-complete" : runStatus === "RUNNING" || runStatus === "QUEUED" ? "state-running" : runStatus === "FAILED" || runStatus === "CANCELLED" ? "state-failed" : "state-idle")}>{runStatus === "RUNNING" ? "RUNNING" : runStatus === "QUEUED" ? "QUEUED" : runStatus === "COMPLETED" ? "PASSED" : runStatus === "FAILED" ? "FAILED" : runStatus === "CANCELLED" ? "CANCELLED" : "READY"}</span></div>{runError && <div className="execution-error" role="alert"><AlertTriangle size={14} /> {runError}</div>}<div className="execution-progress"><div><span>PIPELINE PROGRESS</span><strong>{runProgress}%</strong></div><div className="execution-progress-track"><i style={{ width: `${runProgress}%` }} /></div></div><div className="execution-result-grid"><div><span>SUITES</span><strong>{runResults.suites}</strong><small>{runStatus === "COMPLETED" ? "All modules finalized" : runStatus === "RUNNING" ? "Executing in isolation" : "Awaiting launch"}</small></div><div><span>SECURITY GATES</span><strong>{runResults.gates}</strong><small>{runStatus === "COMPLETED" ? "All gates passed" : "Authorization · state · ledger"}</small></div><div><span>FINDINGS</span><strong>{runResults.findings}</strong><small>{runStatus === "COMPLETED" ? "No blocking findings" : "Live evidence stream"}</small></div><div><span>EVIDENCE</span><strong>{runResults.evidence}</strong><small>{runStatus === "COMPLETED" ? "SARIF · JUnit · JSON" : "Will seal on completion"}</small></div></div>{runStatus === "COMPLETED" && <div className="execution-result-actions"><Button variant="outline" onClick={onOpenHistory}><FileCheck2 size={14} /> VIEW EVIDENCE</Button><Button className="launch-button" onClick={onNewRun} disabled={runLaunching}><Plus size={14} /> RUN AGAIN</Button></div>}</section>
        <div className="dedicated-grid"><section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="RUN QUEUE" title="Isolated executions" /><div className="run-summary-grid"><div><span>ACTIVE RUNS</span><strong>02</strong><small>One running · one queued</small></div><div><span>LAST RISK</span><strong>HIGH</strong><small>Critical gates enforced</small></div><div><span>ISOLATION</span><strong>100%</strong><small>Ephemeral contexts used</small></div></div><div className="dedicated-list">{["run_8f42c1", "run_7a21d0", "run_3c9610"].map((run, index) => <div className="dedicated-row" key={run}><div><strong>{run}</strong><span>{index === 0 ? "RUNNING" : index === 1 ? "QUEUED" : "COMPLETED"}</span></div><b>{index === 0 ? "CRITICAL" : "HIGH"}</b><time>{index === 0 ? "10:42:18" : "10:39:02"}</time></div>)}</div></section><section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="RUN SAFETY" title="Execution guarantees" /><div className="guarantee-list"><div><LockKeyhole size={16} /><span><strong>Ephemeral wallets</strong><small>Destroyed after each run</small></span><Check size={15} /></div><div><Layers3 size={16} /><span><strong>Synthetic assets</strong><small>No production data permitted</small></span><Check size={15} /></div><div><ShieldCheck size={16} /><span><strong>Evidence sealing</strong><small>Reports retain immutable provenance</small></span><Check size={15} /></div></div></section></div><section className="blueprint-card dedicated-panel run-history-panel"><SectionTitle eyebrow="PERSISTED RUN HISTORY" title="Execution ledger" action={<span className="blueprint-tag">OFFSET {historyOffset}</span>} /><div className="run-history-layout"><div className="dedicated-list">{historyRuns.length ? historyRuns.map(run => <button className={cn("dedicated-row run-history-row", selectedRun?.id === run.id && "is-selected")} key={run.id} onClick={() => onSelectRun(run)}><div><strong>{run.id}</strong><span>{run.currentStage} · attempt {run.attempt}</span></div><b>{run.status}</b><time>{new Date(run.createdAt).toLocaleTimeString([], { hour12: false })}</time></button>) : <div className="empty-terminal">No persisted test runs are available.</div>}</div>{selectedRun && <div className="run-detail-card"><div className="eyebrow">RUN DETAIL / {selectedRun.id}</div><h3>{selectedRun.profile}</h3><p>{selectedRun.risk} risk · {selectedRun.progress}% complete · {selectedRun.currentStage}</p><div className="run-detail-metrics"><span>STATUS <strong>{selectedRun.status}</strong></span><span>ATTEMPT <strong>{selectedRun.attempt}</strong></span><span>CHAIN <strong>{selectedRun.isolation.chainId}</strong></span></div><div className="execution-result-actions">{(selectedRun.status === "QUEUED" || selectedRun.status === "RUNNING") && <Button variant="outline" onClick={() => onCancelRun(selectedRun.id)}>CANCEL RUN</Button>}{selectedRun.status === "FAILED" || selectedRun.status === "CANCELLED" ? <><Button variant="outline" onClick={() => onRetryRun(selectedRun.id)}>RETRY</Button><Button className="launch-button" onClick={() => onResumeRun(selectedRun.id)}>RESUME</Button></> : null}</div></div>}</div><div className="run-history-pagination"><Button variant="outline" size="sm" onClick={onHistoryPrevious} disabled={historyOffset === 0}>PREVIOUS</Button><span>PAGE {Math.floor(historyOffset / Math.max(historyRuns.length, 1)) + 1}</span><Button variant="outline" size="sm" onClick={onHistoryNext} disabled={!historyHasMore}>NEXT</Button></div></section></>}

      {activeNav === "Test engine" && <section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="MODULE REGISTRY" title="Security suite execution" action={<span className="blueprint-tag">{suites.length} MODULES</span>} /><div className="dedicated-suite-list">{suites.map(([name, Icon, count, status, detail, progress]) => <div className="dedicated-suite-row" key={name}><div className="suite-icon"><Icon size={15} /></div><div className="suite-info"><strong>{name}</strong><span>{detail}</span></div><span className={cn("suite-status", status === "PASS" ? "status-pass" : status === "RUNNING" ? "status-running" : "status-warn")}>{status}</span><b>{count}</b><div className="suite-progress"><i style={{ width: progress }} /></div></div>)}</div></section>}

      {activeNav === "Findings" && <section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="TRIAGE QUEUE" title="Active security findings" action={<span className="severity-high">{displayFindings.length.toString().padStart(2, "0")} OPEN</span>} /><div className="findings-detail-grid"><div className="dedicated-list">{displayFindings.map(finding => <div className="dedicated-row finding-row" key={finding.id}><div><strong>{finding.id} · {finding.category}</strong><span>{finding.component} / {finding.asset ?? "—"}</span></div><b className={severityClass(finding.severity)}>{finding.severity}</b><span>{finding.status}</span></div>)}</div><div className="finding-detail dedicated-callout"><div className="eyebrow">SELECTED CONTROL</div><h3>Independent authorization enforcement</h3><p>Blocked proxy upgrades, unauthorized transfers, and reconciliation mismatches remain linked to their evidence and remediation records.</p><Button variant="outline">OPEN TRIAGE WORKFLOW <ChevronRight size={13} /></Button></div></div></section>}

      {activeNav === "Reconciliation" && <div className="dedicated-grid"><section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="STATE COMPARISON" title="Five-layer reconciliation" action={<span className="sync-ok"><Check size={13} /> 5 / 5 ALIGNED</span>} /><div className="recon-detail-list">{["Blockchain", "Smart Contract", "Application DB", "Asset Ledger", "Reporting System"].map((layer, index) => <div key={layer}><span className="recon-index">0{index + 1}</span><div><strong>{layer}</strong><small>{index === 0 ? "Block 19,421 · canonical source" : index === 1 ? "Decoded events · contract state" : "Independent ledger projection"}</small></div><b><Check size={12} /> ALIGNED</b></div>)}</div></section><section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="EVIDENCE QUALITY" title="Mismatch posture" /><div className="reconciliation-score"><strong>0</strong><span>unresolved mismatches</span></div><p className="dedicated-copy">Every observed movement is compared against an independently derived ledger representation before the report is sealed.</p></section></div>}

      {activeNav === "Evidence & reports" && <section className="blueprint-card dedicated-panel"><SectionTitle eyebrow="REPORT REGISTRY" title="Retained evidence" action={<span className="blueprint-tag">SARIF · JUNIT · JSON · HTML</span>} /><div className="report-command-grid"><div><strong>Nightly CI evidence</strong><span>{reportAudit.length} persisted report records available</span></div><div><strong>Retention posture</strong><span>Signed artifacts · auditable tombstones · 30-day default</span></div><div><strong>Code scanning</strong><span>SARIF source locations linked to blocked proxy findings</span></div></div><div className="report-history dedicated-report-list">{reportAudit.slice(0, 6).map(event => <div key={`${event.time}-${event.action}`}><span>{event.metadata?.format ?? "REPORT"}</span><strong>{event.metadata?.runId ?? "LOCAL"}</strong><small>{event.metadata?.findingCount ?? 0} findings · {event.metadata?.source ?? "MANUAL"}</small></div>)}</div></section>}
    </section>
  );
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Command center");
  const [runOpen, setRunOpen] = useState(false);
  const [risk, setRisk] = useState<Severity>("CRITICAL");
  const [parallel, setParallel] = useState(true);
  const [runProfile, setRunProfile] = useState<RunProfile>("critical-core");
  const [enabledSuites, setEnabledSuites] = useState(() => suites.map(([name]) => name));
  const [logFilter, setLogFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");
  const [logs, setLogs] = useState(initialLogs);
  const [streamState, setStreamState] = useState<"CONNECTING" | "CONNECTED" | "DISCONNECTED">("CONNECTING");
  const [reportHistoryOpen, setReportHistoryOpen] = useState(false);
  const [reportRunFilter, setReportRunFilter] = useState("");
  const [reportFormatFilter, setReportFormatFilter] = useState("ALL");
  const [reportSourceFilter, setReportSourceFilter] = useState("ALL");
  const [reportPage, setReportPage] = useState(1);
  const [runStatus, setRunStatus] = useState<RunStatus>("IDLE");
  const [runProgress, setRunProgress] = useState(0);
  const [lastRunId, setLastRunId] = useState("run_8f42c1");
  const [runError, setRunError] = useState<string | null>(null);
  const [runResults, setRunResults] = useState<RunResults>({ suites: "—", gates: "—", findings: "—", evidence: "OPEN" });
  const [runHistoryOffset, setRunHistoryOffset] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: snapshot, isLoading: snapshotLoading, isError: snapshotError } = trpc.dashboard.snapshot.useQuery();
  const historyInput = useMemo(() => ({ limit: 5, offset: runHistoryOffset }), [runHistoryOffset]);
  const runHistoryQuery = trpc.dashboard.runHistory.useQuery(historyInput, { enabled: activeNav === "Test runs" });
  const runDetailQuery = trpc.dashboard.runDetail.useQuery({ runId: selectedRunId ?? "__none__" }, { enabled: Boolean(selectedRunId) });
  const createRunMutation = trpc.dashboard.createRun.useMutation();
  const cancelRunMutation = trpc.dashboard.cancelRun.useMutation();
  const retryRunMutation = trpc.dashboard.retryRun.useMutation();
  const resumeRunMutation = trpc.dashboard.resumeRun.useMutation();
  const trpcUtils = trpc.useUtils();
  const reportMutation = trpc.dashboard.requestReport.useMutation();
  const suiteMutation = trpc.dashboard.configureSuite.useMutation();
  const securityScore = snapshot?.score ?? 96;
  const displayMetricCards = (snapshot?.metrics ?? metricCards).map((metric, index) => ({ ...metric, icon: metricCards[index]?.icon ?? Gauge, tone: metricCards[index]?.tone ?? "blue" }));
  const displayFindings = snapshot?.findings ?? findingRows;
  const reportAudit = (snapshot?.audit ?? []).filter(event => Boolean(event.metadata?.format));
  const historyRuns = (runHistoryQuery.data?.rows ?? []) as DashboardRun[];
  const selectedRun = (selectedRunId ? historyRuns.find(run => run.id === selectedRunId) ?? runDetailQuery.data : historyRuns[0]) as DashboardRun | undefined;
  useEffect(() => {
    if (!selectedRunId && historyRuns[0]) setSelectedRunId(historyRuns[0].id);
    if (selectedRunId && !historyRuns.some(run => run.id === selectedRunId) && !runDetailQuery.data) setSelectedRunId(historyRuns[0]?.id ?? null);
  }, [historyRuns, selectedRunId, runDetailQuery.data]);
  const reportSources = Array.from(new Set(reportAudit.map(event => event.metadata?.source).filter(Boolean)));
  const filteredReports = useMemo(() => reportAudit.filter(event => {
    const metadata = event.metadata;
    return (!reportRunFilter || (metadata?.runId ?? "").toLowerCase().includes(reportRunFilter.toLowerCase())) &&
      (reportFormatFilter === "ALL" || metadata?.format === reportFormatFilter) &&
      (reportSourceFilter === "ALL" || metadata?.source === reportSourceFilter);
  }), [reportAudit, reportFormatFilter, reportRunFilter, reportSourceFilter]);
  const reportPageSize = 5;
  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / reportPageSize));
  const visibleReports = filteredReports.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize);
  useEffect(() => {
    const latest = snapshot?.runs?.[0];
    if (!latest) return;
    setLastRunId(latest.id);
    setRunStatus(latest.status === "QUEUED" ? "QUEUED" : latest.status === "RUNNING" ? "RUNNING" : latest.status === "PASSED" ? "COMPLETED" : latest.status === "FAILED" ? "FAILED" : latest.status === "CANCELLED" ? "CANCELLED" : "IDLE");
    setRunProgress(latest.progress ?? 0);
    if (latest.results) setRunResults(latest.results);
  }, [snapshot]);
  useEffect(() => {
    setReportPage(1);
  }, [reportFormatFilter, reportRunFilter, reportSourceFilter]);
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const stream = new WebSocket(`${protocol}//${window.location.host}/ws/execution`);
    stream.onopen = () => setStreamState("CONNECTED");
    stream.onerror = () => setStreamState("DISCONNECTED");
    stream.onclose = () => setStreamState("DISCONNECTED");
    stream.onmessage = event => {
      try {
        const payload = JSON.parse(event.data) as { time: string; level: Severity | "INFO"; message: string; status?: "QUEUED" | "RUNNING" | "PASSED" | "FAILED" | "CANCELLED" | "BLOCKED"; progress?: number; results?: RunResults; stage?: string; attempt?: number; runId?: string };
        setLogs(current => [{ time: new Date(payload.time).toLocaleTimeString([], { hour12: false }) + ".000", level: payload.level, message: payload.message }, ...current].slice(0, 40));
        if (payload.results) setRunResults(payload.results);
        if (payload.status === "QUEUED") { setRunStatus("QUEUED"); setRunProgress(payload.progress ?? 8); }
        if (payload.status === "RUNNING") { setRunStatus("RUNNING"); setRunProgress(payload.progress ?? 55); }
        if (payload.status === "PASSED") { setRunStatus("COMPLETED"); setRunProgress(payload.progress ?? 100); }
        if (payload.status === "FAILED") { setRunStatus("FAILED"); setRunProgress(payload.progress ?? 0); setRunError(payload.message); }
        if (payload.status === "CANCELLED") { setRunStatus("CANCELLED"); setRunProgress(payload.progress ?? 0); }
        if (payload.runId) void trpcUtils.dashboard.runHistory.invalidate();
      } catch {
        // Ignore malformed stream events; deterministic local events remain available.
      }
    };
    return () => stream.close();
  }, []);
  const filteredLogs = useMemo(() => logs.filter(log => (logFilter === "ALL" || log.level === logFilter) && log.message.toLowerCase().includes(logSearch.toLowerCase())), [logs, logFilter, logSearch]);

  const refreshRunData = () => {
    void trpcUtils.dashboard.snapshot.invalidate();
    void trpcUtils.dashboard.runHistory.invalidate();
    if (selectedRunId) void trpcUtils.dashboard.runDetail.invalidate({ runId: selectedRunId });
  };
  const launchRun = () => {
    setRunOpen(false);
    setRunError(null);
    setRunStatus("QUEUED");
    setRunProgress(5);
    setRunResults({ suites: "—", gates: "—", findings: "—", evidence: "OPEN" });
    createRunMutation.mutate({ risk, parallel, profile: runProfile }, {
      onSuccess: run => {
        setLastRunId(run.id);
        setActiveNav("Test runs");
        setRunStatus(run.status === "QUEUED" ? "QUEUED" : run.status === "RUNNING" ? "RUNNING" : run.status === "PASSED" ? "COMPLETED" : run.status === "CANCELLED" ? "CANCELLED" : "FAILED");
        setRunProgress(run.status === "PASSED" ? 100 : run.status === "RUNNING" ? 55 : 5);
        refreshRunData();
      },
      onError: error => {
        setRunStatus("FAILED");
        setRunProgress(0);
        setRunError(error.message === "Unable to transform response from server" ? "Run could not be queued. Verify authorization and try again." : error.message || "The run could not be queued.");
        setActiveNav("Test runs");
      },
    });
    setLogs(current => [{ time: new Date().toLocaleTimeString([], { hour12: false }) + ".000", level: "INFO", message: `TEST RUN QUEUED · ${runProfile} · risk ${risk} · parallel ${parallel ? "enabled" : "disabled"}` }, ...current]);
  };
  const controlRun = (action: "cancel" | "retry" | "resume", runId: string) => {
    const mutation = action === "cancel" ? cancelRunMutation : action === "retry" ? retryRunMutation : resumeRunMutation;
    mutation.mutate({ runId }, { onSuccess: refreshRunData, onError: error => setRunError(error.message) });
  };

  return (
    <div className="bsafe-app">
      <aside className="blueprint-sidebar">
        <div className="brand-lockup"><div className="brand-mark brand-logo-frame"><img src="/manus-storage/bsafe-logo_3057dd9c.png" alt="B-SAFE logo" /></div></div>
        <div className="sidebar-rule" />
        <div className="side-label">CONTROL PLANE <span>01</span></div>
        <nav className="side-nav">
          {[ ["Command center", Gauge], ["Test runs", Play], ["Test engine", Settings2], ["Findings", AlertTriangle], ["Reconciliation", RefreshCcw], ["Evidence & reports", FileCheck2] ].map(([label, Icon]) => (
            <button key={label as string} className={cn("side-nav-item", activeNav === label && "is-active")} onClick={() => setActiveNav(label as string)}><Icon size={15} /><span>{label as string}</span>{label === "Findings" && <b>03</b>}</button>
          ))}
        </nav>
        <div className="side-label side-label-spaced">SYSTEM <span>02</span></div>
        <nav className="side-nav"><button className="side-nav-item"><LockKeyhole size={15} /><span>Access control</span></button><button className="side-nav-item"><GitBranch size={15} /><span>CI / CD gates</span></button><button className="side-nav-item"><Command size={15} /><span>CLI reference</span></button></nav>
        <div className="sidebar-footer"><div className="network-status"><span className="pulse-dot" /> <span>LOCAL FORK</span><b>ONLINE</b></div><div className="network-meta"><span>chain_id</span><strong>31337</strong><span>block</span><strong>19,421</strong></div></div>
      </aside>

      <main className="blueprint-main">
        <header className="topbar"><div className="breadcrumb"><span>BSAFE /</span><strong>{activeNav.toUpperCase()}</strong></div><div className="topbar-actions"><div className="role-chip"><span className="role-avatar">AK</span><span>ANALYST</span><ChevronRight size={13} /></div><Button className="launch-button" onClick={() => setRunOpen(true)} disabled={createRunMutation.isPending}><Plus size={15} /> {createRunMutation.isPending ? "PREPARING RUN" : "NEW TEST RUN"}</Button></div></header>
        <div className="main-scroll">
          {activeNav !== "Command center" && <DedicatedView activeNav={activeNav} displayFindings={displayFindings} reportAudit={reportAudit} onNewRun={() => setRunOpen(true)} onConfigure={() => setRunOpen(true)} onOpenHistory={() => setReportHistoryOpen(true)} runStatus={runStatus} runProgress={runProgress} lastRunId={lastRunId} runError={runError} runLaunching={createRunMutation.isPending} runResults={runResults} historyRuns={historyRuns} historyHasMore={runHistoryQuery.data?.hasMore ?? false} historyOffset={runHistoryOffset} selectedRun={selectedRun} onSelectRun={run => setSelectedRunId(run.id)} onHistoryNext={() => setRunHistoryOffset(offset => offset + 5)} onHistoryPrevious={() => setRunHistoryOffset(offset => Math.max(0, offset - 5))} onCancelRun={runId => controlRun("cancel", runId)} onRetryRun={runId => controlRun("retry", runId)} onResumeRun={runId => controlRun("resume", runId)} />}
          <div className={cn("command-center-view", activeNav !== "Command center" && "view-hidden")}>
          <section className="hero-row"><div><div className="eyebrow"><span className="live-indicator" /> SYSTEM STATUS / CONTINUOUS SECURITY</div><h1>Command center</h1><p className="hero-subtitle">Independent verification across application, blockchain, contract, cryptographic, and ledger state.</p></div><div className="hero-meta"><span>LAST SYNCHRONIZED</span><strong>18 AUG 2026 · 10:42:24 UTC</strong><span className="sync-ok"><Check size={12} /> ALL SYSTEMS NOMINAL</span></div></section>

          <section className="score-band blueprint-frame"><div className="score-panel"><div className="eyebrow">OVERALL SECURITY SCORE</div><div className="score-value">{securityScore}<span>/100</span></div><div className="score-foot"><span className="score-bar"><i style={{ width: "96%" }} /></span><span>+3.2% <ArrowUpRight size={12} /></span></div></div><div className="score-divider" /><div className="score-explain"><div className="score-explain-icon"><Fingerprint size={21} /></div><div><strong>BUSINESS VALIDITY GATE: PASSED</strong><p>Transaction Valid <i>AND</i> Signature Valid <i>AND</i> Authorization Valid <i>AND</i> Asset State Valid <i>AND</i> Reconciliation Valid</p></div></div><div className="frame-corner frame-corner-tl" /><div className="frame-corner frame-corner-br" /></section>

          <section><SectionTitle eyebrow="01 / TELEMETRY" title="Quality & blockchain metrics" action={<span className={cn("section-note", snapshotError && "severity-high")}><CircleDot size={12} /> {snapshotLoading ? "SYNCING" : snapshotError ? "BACKEND DEGRADED" : "LIVE AGGREGATE"}</span>} /><div className="metric-grid">{displayMetricCards.map(card => <MetricCard key={card.label} card={card} />)}</div></section>

          <div className="dashboard-grid"><section className="blueprint-card chart-card"><SectionTitle eyebrow="02 / RISK DISTRIBUTION" title="Security posture" action={<span className="blueprint-tag">RUN_8F42C1</span>} /><div className="posture-layout"><div className="donut"><div><strong>96</strong><span>/100</span></div></div><div className="posture-list">{([ ["CRITICAL", 0, "#ff5367"], ["HIGH", 3, "#ffb547"], ["MEDIUM", 8, "#7dc8ff"], ["LOW", 12, "#8fe6c1"] ] as const).map(([label, count, color]) => <div className="posture-row" key={label}><span className="legend-dot" style={{ background: color }} /><span>{label}</span><strong>{count.toString().padStart(2, "0")}</strong><div className="posture-track"><i style={{ width: `${Math.max(count * 5, 3)}%`, background: color }} /></div></div>)}</div></div><div className="chart-footer"><span><LockKeyhole size={13} /> 0 critical gates breached</span><span>27 findings total <ChevronRight size={13} /></span></div></section>
            <section className="blueprint-card lifecycle-card"><SectionTitle eyebrow="03 / STATE MACHINE" title="Asset lifecycle" action={<span className="blueprint-tag">ASSET-10291</span>} /><div className="lifecycle-track">{["Creation", "Registration", "Tokenization", "Ownership", "Transfer", "Settlement", "Custody", "Valuation", "Redemption", "Burn"].map((stage, index) => <div className={cn("lifecycle-node", index < 5 && "complete", index === 5 && "current")} key={stage}><span>{String(index + 1).padStart(2, "0")}</span><i>{index < 5 ? <Check size={12} /> : index === 5 ? <Activity size={12} /> : null}</i><b>{stage}</b>{index < 9 && <em />}</div>)}</div><div className="lifecycle-foot"><span><span className="pulse-dot" /> CURRENT STATE: SETTLEMENT</span><span>5 / 10 VERIFIED</span></div></section></div>

          <section className="blueprint-card terminal-card"><SectionTitle eyebrow="04 / EXECUTION STREAM" title="Real-time execution terminal" action={<div className="terminal-actions"><div className="search-field"><Search size={13} /><input placeholder="Search events..." value={logSearch} onChange={e => setLogSearch(e.target.value)} /></div><select value={logFilter} onChange={e => setLogFilter(e.target.value)}><option value="ALL">ALL SEVERITIES</option>{severityOrder.map(s => <option key={s}>{s}</option>)}</select><Button variant="outline" size="sm" onClick={() => setLogs(initialLogs)}><RefreshCcw size={13} /></Button></div>} /><div className="terminal-body">{filteredLogs.map((log, index) => <div className="log-line" key={`${log.time}-${index}`}><time>{log.time}</time><span className={cn("log-level", severityClass(log.level))}>{log.level}</span><span className="log-message">{log.message}</span>{log.hash && <code>{log.hash}</code>}{log.block && <span className="block-label">BLOCK {log.block}</span>}</div>)}{filteredLogs.length === 0 && <div className="empty-terminal">No events match this filter.</div>}</div><div className="terminal-status"><span><span className={cn("pulse-dot", streamState === "DISCONNECTED" && "stream-off")} /> STREAM {streamState} / WS-LOCAL-01</span><span>BUFFER 09 / 500</span><span>SCROLL LOCK: OFF</span></div></section>

          <div className="dashboard-grid lower-grid"><section className="blueprint-card suite-card"><SectionTitle eyebrow="05 / MODULAR TEST ENGINE" title="Suite execution" action={<Button variant="outline" size="sm" onClick={() => setRunOpen(true)}><Settings2 size={13} /> CONFIGURE</Button>} /><div className="suite-list">{suites.filter(([name]) => enabledSuites.includes(name)).map(([name, Icon, count, status, detail, progress]) => <div className="suite-row" key={name}><div className="suite-icon"><Icon size={15} /></div><div className="suite-info"><strong>{name}</strong><span>{detail}</span></div><span className={cn("suite-status", status === "PASS" ? "status-pass" : status === "RUNNING" ? "status-running" : "status-warn")}>{status}</span><div className="suite-count">{count}</div><div className="suite-progress"><i style={{ width: progress }} /></div><ChevronRight size={14} className="suite-arrow" /></div>)}</div></section>
            <section className="blueprint-card findings-card"><SectionTitle eyebrow="06 / SECURITY FINDINGS" title="Active findings" action={<Button variant="ghost" size="sm">VIEW ALL <ChevronRight size={13} /></Button>} /><div className="finding-list">{displayFindings.map(finding => <div className="finding-row" key={finding.id}><span className={cn("finding-severity", severityClass(finding.severity))}>{finding.severity}</span><div><strong>{finding.id} · {finding.category}</strong><span>{finding.component} / {"asset" in finding ? String(finding.asset) : "—"}</span></div><span className="finding-status">{finding.status}</span></div>)}</div><div className="finding-detail"><div className="eyebrow">SELECTED FINDING · FND-0042</div><h3>Unauthorized asset transfer attempt</h3><p><strong>Expected:</strong> User-784 must not transfer ASSET-10291. <strong>Actual:</strong> request rejected at contract authorization boundary.</p><div className="evidence-tags"><span>TX 0x7b91…e4c2</span><span>BLOCK 19,421</span><span>REPRODUCIBLE</span></div></div></section></div>

          <section className="blueprint-card reconciliation-card"><SectionTitle eyebrow="07 / INDEPENDENT ORACLES" title="Reconciliation matrix" action={<span className="sync-ok"><Check size={13} /> 5 / 5 ALIGNED</span>} /><div className="reconciliation-flow">{[ ["Blockchain", Blocks], ["Smart Contract", Code2], ["Application DB", Database], ["Asset Ledger", FileCheck2], ["Reporting System", FileCheck2] ].map(([label, Icon], index) => <div className="recon-layer" key={label as string}><div className="recon-icon"><Icon size={16} /></div><span>{label as string}</span><b><Check size={12} /> ALIGNED</b>{index < 4 && <ArrowDownRight size={15} className="recon-arrow" />}</div>)}</div></section>

          <section className="dashboard-grid enterprise-grid"><section className="blueprint-card compliance-card"><SectionTitle eyebrow="08 / EVIDENCE CONTROL" title="Compliance mappings & reports" action={<div className="section-action-group"><Button variant="outline" size="sm" onClick={() => setReportHistoryOpen(true)}><Clock3 size={13} /> VIEW HISTORY</Button><span className="blueprint-tag">TECHNICAL EVIDENCE ONLY</span></div>} /><div className="compliance-grid">{["OWASP", "CWE", "NIST", "SOC 2", "ISO 27001"].map((framework, index) => <div className="compliance-item" key={framework}><span>{String(index + 1).padStart(2, "0")}</span><strong>{framework}</strong><small>{index < 3 ? "MAPPED" : "CONFIGURABLE"}</small></div>)}</div><div className="report-row"><div><div className="eyebrow">EXPORT EVIDENCE PACKAGE</div><p>Technical test evidence is not a formal regulatory compliance claim.</p></div><div className="format-options">{["HTML", "JSON", "JUnit", "SARIF"].map(format => <button key={format} onClick={() => { reportMutation.mutate(format as "HTML" | "JSON" | "JUnit" | "SARIF"); setLogs(current => [{ time: new Date().toLocaleTimeString([], { hour12: false }) + ".000", level: "INFO", message: `REPORT EXPORT REQUESTED · format ${format} · evidence package queued` }, ...current]); }}>{format}</button>)}</div></div><div className="report-history">{reportAudit.length ? reportAudit.slice(0, 3).map(event => <div key={`${event.time}-${event.action}`}><span>{event.metadata?.format ?? "REPORT"}</span><strong>{event.metadata?.runId ?? "LOCAL"}</strong><small>{event.metadata?.findingCount ?? 0} findings · {event.metadata?.expiresAt ? `expires ${new Date(event.metadata.expiresAt).toLocaleDateString()}` : event.metadata?.artifactPath ?? "artifact retained"}</small></div>) : <span className="report-history-empty">Nightly report metadata will appear after CI ingestion.</span>}</div></section><section className="blueprint-card governance-card"><SectionTitle eyebrow="09 / GOVERNANCE" title="Access & audit" action={<span className="sync-ok"><LockKeyhole size={13} /> SESSION SECURE</span>} /><div className="governance-role"><div className="role-avatar large">AK</div><div><strong>ANALYST / A. KUMAR</strong><span>Last authenticated 10:39:02 UTC · MFA verified</span></div><Badge>ACTIVE</Badge></div><div className="audit-list"><div><time>10:42:23</time><span>Test run evidence package sealed</span><b>ANALYST</b></div><div><time>10:41:56</time><span>Reconciliation policy inspected</span><b>ANALYST</b></div><div><time>10:39:02</time><span>Session established with MFA</span><b>SYSTEM</b></div></div><div className="role-foot"><span>RBAC POLICY</span><strong>ADMIN · ANALYST</strong><span className="role-lock"><LockKeyhole size={12} /> LEAST PRIVILEGE</span></div></section></section>

          <footer className="app-footer"><span>B·SAFE / ENGINEERING CONTROL PLANE / v0.1.0-alpha</span><span>SECURITY-BY-DESIGN <ShieldCheck size={12} /> · EVIDENCE IMMUTABLE</span></footer>
          </div>
        </div>
      </main>

      {reportHistoryOpen && <div className="modal-backdrop" onClick={() => setReportHistoryOpen(false)}><div className="run-modal report-history-modal blueprint-card" role="dialog" aria-modal="true" aria-labelledby="report-history-title" onClick={e => e.stopPropagation()}><div className="modal-header"><div><div className="eyebrow">EVIDENCE CONTROL / REPORT HISTORY</div><h2 id="report-history-title">Nightly report history</h2></div><button aria-label="Close report history" onClick={() => setReportHistoryOpen(false)}><XCircle size={18} /></button></div><p className="modal-copy">Filter persisted CI evidence metadata by run ID, report format, and ingestion source.</p><div className="report-filter-grid"><label>RUN ID<input value={reportRunFilter} onChange={e => setReportRunFilter(e.target.value)} placeholder="Search run ID" /></label><label>FORMAT<select value={reportFormatFilter} onChange={e => setReportFormatFilter(e.target.value)}><option value="ALL">ALL FORMATS</option>{["HTML", "JSON", "JUnit", "SARIF"].map(format => <option key={format}>{format}</option>)}</select></label><label>SOURCE<select value={reportSourceFilter} onChange={e => setReportSourceFilter(e.target.value)}><option value="ALL">ALL SOURCES</option>{reportSources.map(source => <option key={source}>{source}</option>)}</select></label></div><div className="report-history-detail">{visibleReports.length ? visibleReports.map(event => <div className="report-history-detail-row" key={`${event.time}-${event.action}-${event.metadata?.runId}`}><div><strong>{event.metadata?.format ?? "REPORT"}</strong><span>{event.metadata?.runId ?? "LOCAL"}</span></div><div><span>{event.metadata?.source ?? "MANUAL"}</span><small>{event.metadata?.findingCount ?? 0} findings · {event.metadata?.expiresAt ? `expires ${new Date(event.metadata.expiresAt).toLocaleDateString()}` : event.metadata?.artifactPath ?? "artifact retained"}</small></div><time>{event.metadata?.generatedAt ?? event.time}</time>{event.metadata?.artifactPath && <a className="report-download" href={artifactHref(event.metadata.artifactPath, event.metadata.artifactKey, event.metadata.artifactUrl)} download target="_blank" rel="noreferrer">DOWNLOAD <Download size={12} /></a>}</div>) : <div className="empty-terminal">No report records match the selected filters.</div>}</div><div className="report-pagination"><span>PAGE {reportPage} / {reportPageCount} · {filteredReports.length} REPORTS</span><div><Button variant="outline" size="sm" disabled={reportPage <= 1} onClick={() => setReportPage(page => Math.max(1, page - 1))}>PREVIOUS</Button><Button variant="outline" size="sm" disabled={reportPage >= reportPageCount} onClick={() => setReportPage(page => Math.min(reportPageCount, page + 1))}>NEXT</Button></div></div><div className="modal-actions"><Button variant="outline" onClick={() => { setReportRunFilter(""); setReportFormatFilter("ALL"); setReportSourceFilter("ALL"); setReportPage(1); }}>CLEAR FILTERS</Button><Button className="launch-button" onClick={() => setReportHistoryOpen(false)}>CLOSE</Button></div></div></div>}

      {runOpen && <div className="modal-backdrop" onClick={() => setRunOpen(false)}><div className="run-modal new-run-modal blueprint-card" role="dialog" aria-modal="true" aria-labelledby="new-run-title" onClick={e => e.stopPropagation()}><div className="modal-header"><div><div className="eyebrow"><span className="live-indicator" /> CONTROL PLANE / NEW RUN</div><h2 id="new-run-title">Authorize a security run</h2><p className="modal-subtitle">Define the execution envelope before B-SAFE touches the isolated fork.</p></div><button aria-label="Close new test run" onClick={() => setRunOpen(false)}><XCircle size={18} /></button></div><div className="run-readiness"><span className="readiness-dot" /><div><strong>READY TO PROVISION</strong><small>LOCAL FORK · CHAIN 31337 · EVIDENCE SEALED</small></div><span className="blueprint-tag">RBAC / ANALYST</span></div><div className="new-run-section"><div className="new-run-section-heading"><span className="eyebrow">01 / THREAT POSTURE</span><span className="section-note">SELECT ONE</span></div><div className="risk-selector">{severityOrder.map(level => <button key={level} type="button" className={cn("risk-option", `risk-${level.toLowerCase()}`, risk === level && "is-selected")} onClick={() => setRisk(level)}><span className="risk-radio" /><span><strong>{level}</strong><small>{level === "CRITICAL" ? "Maximum gate depth and attack-path coverage" : level === "HIGH" ? "Authorization, state, and asset integrity" : level === "MEDIUM" ? "Focused regression and lifecycle validation" : "Fast smoke verification on safe paths"}</small></span><b>{risk === level ? "ACTIVE" : ""}</b></button>)}</div></div><div className="new-run-section"><div className="new-run-section-heading"><span className="eyebrow">02 / EXECUTION PROFILE</span><span className="section-note">{runProfiles.find(profile => profile.value === runProfile)?.duration}</span></div><div className="profile-selector">{runProfiles.map(profile => <button key={profile.value} type="button" className={cn("profile-option", `profile-${profile.color}`, runProfile === profile.value && "is-selected")} onClick={() => setRunProfile(profile.value)}><span className="profile-index">{String(runProfiles.findIndex(item => item.value === profile.value) + 1).padStart(2, "0")}</span><span><strong>{profile.label}</strong><small>{profile.scope}</small></span><b>{profile.modules} MODULES</b></button>)}</div></div><div className="new-run-controls"><label className="field-block">RISK SNAPSHOT<select value={risk} onChange={e => setRisk(e.target.value as Severity)}>{severityOrder.map(level => <option key={level}>{level}</option>)}</select></label><label className="switch-line"><span><strong>PARALLEL EXECUTION</strong><small>Fan out suites across isolated workers.</small></span><Switch checked={parallel} onCheckedChange={setParallel} /></label></div><div className="isolation-box enhanced-isolation"><span><WalletCards size={15} /><b>EPHEMERAL WALLET</b><small>Scoped signer</small></span><span><Fingerprint size={15} /><b>SYNTHETIC ASSETS</b><small>Disposable namespace</small></span><span><LockKeyhole size={15} /><b>ISOLATED STATE</b><small>Fork-only writes</small></span></div><div className="suite-config-strip enhanced-suite-strip"><span><Settings2 size={13} /> MODULE ALLOWLIST</span><div className="suite-toggles">{suites.slice(0, 4).map(([name]) => <label key={name}><input type="checkbox" checked={enabledSuites.includes(name)} onChange={() => { const enabled = !enabledSuites.includes(name); setEnabledSuites(current => enabled ? [...current, name] : current.filter(item => item !== name)); suiteMutation.mutate({ suiteName: name, enabled, profile: runProfile }); }} /> <span>{name}</span></label>)}</div><span className="module-count"><Filter size={13} /> {enabledSuites.length} / {suites.length}</span></div><div className="run-launch-summary"><span>LAUNCH TARGET <strong>{runProfile.toUpperCase()}</strong></span><span>RISK <strong className={severityClass(risk)}>{risk}</strong></span><span>MODULES <strong>{enabledSuites.length}</strong></span></div><div className="modal-actions"><Button variant="outline" onClick={() => setRunOpen(false)}>CANCEL</Button><Button className="launch-button launch-primary" onClick={launchRun} disabled={createRunMutation.isPending || enabledSuites.length === 0}><Play size={14} /> {createRunMutation.isPending ? "PROVISIONING..." : `LAUNCH ${risk} RUN`}</Button></div></div></div>}
    </div>
  );
}
