import { createHash } from "node:crypto";
import { persistAuditEvent, persistFinding } from "./db";
import { storagePut } from "./storage";

export type SarifLocation = { physicalLocation: { artifactLocation: { uri: string }; region?: { startLine?: number; startColumn?: number } } };
export type IngestedFinding = { findingKey: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; category: string; component: string; status: string; expectedBehavior?: string; actualBehavior?: string; locations?: SarifLocation[] };

const severityFrom = (value: unknown): IngestedFinding["severity"] => {
  const normalized = String(value ?? "LOW").toUpperCase();
  return normalized === "CRITICAL" || normalized === "HIGH" || normalized === "MEDIUM" ? normalized : "LOW";
};
const keyFor = (value: string) => `CI-${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;

export function parseSarif(content: string): IngestedFinding[] {
  const document = JSON.parse(content) as { runs?: Array<{ results?: Array<{ ruleId?: string; level?: string; message?: { text?: string }; locations?: Array<{ physicalLocation?: { artifactLocation?: { uri?: string }; region?: { startLine?: number; startColumn?: number } } }> }> }> };
  return (document.runs ?? []).flatMap(run => (run.results ?? []).map(result => {
    const message = result.message?.text ?? "Automated finding reported by SARIF";
    const component = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? "controlled-hardhat";
    return { findingKey: keyFor(`${result.ruleId ?? "SARIF"}:${message}:${component}`), severity: severityFrom(result.level), category: result.ruleId ?? "CI security finding", component, status: "OPEN", actualBehavior: message, locations: result.locations?.map(location => ({ physicalLocation: { artifactLocation: { uri: location.physicalLocation?.artifactLocation?.uri ?? component }, region: location.physicalLocation?.region } })) };
  }));
}

export function parseJunit(content: string): IngestedFinding[] {
  const findings: IngestedFinding[] = [];
  for (const match of Array.from(content.matchAll(/<testcase[^>]*name="([^"]+)"[^>]*classname="([^"]+)"[^>]*>([\s\S]*?)<\/testcase>/g))) {
    const body = match[3] ?? "";
    if (!body.includes("<failure") && !body.includes("<error")) continue;
    const name = match[1] ?? "JUnit failure";
    const component = match[2] ?? "controlled-hardhat";
    findings.push({ findingKey: keyFor(`${name}:${component}`), severity: "HIGH", category: "CI integration failure", component, status: "OPEN", actualBehavior: name });
  }
  return findings;
}

export async function ingestFindings(findings: readonly IngestedFinding[]) {
  for (const finding of findings) await persistFinding(finding);
  return { ingested: findings.length, findingKeys: findings.map(finding => finding.findingKey) };
}

export async function publishReportArtifact(input: { runId: string; format: "SARIF" | "JUnit" | "JSON" | "HTML"; content: string }) {
  const extension = input.format === "JUnit" ? "junit.xml" : input.format.toLowerCase();
  return storagePut(`bsafe-reports/${input.runId}/bsafe.${extension}`, input.content, input.format === "SARIF" ? "application/sarif+json" : input.format === "JUnit" ? "application/xml" : "application/octet-stream");
}

export async function ingestNightlyReport(input: { runId: string; format: "SARIF" | "JUnit"; artifactPath: string; content: string; artifactKey?: string; artifactUrl?: string; generatedAt?: string; retentionDays?: number }) {
  const findings = input.format === "SARIF" ? parseSarif(input.content) : parseJunit(input.content);
  const result = await ingestFindings(findings);
  const generatedAt = new Date(input.generatedAt ?? Date.now());
  const retentionDays = input.retentionDays ?? 30;
  const expiresAt = new Date(generatedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  await persistAuditEvent(`Nightly ${input.format} report ingested`, "SYSTEM", JSON.stringify({ source: "github-actions", format: input.format, generatedAt: generatedAt.toISOString(), expiresAt: expiresAt.toISOString(), artifactPath: input.artifactPath, artifactKey: input.artifactKey, artifactUrl: input.artifactUrl, runId: input.runId, findingCount: result.ingested, retentionDays }));
  return { ...result, runId: input.runId, format: input.format, artifactPath: input.artifactPath, artifactKey: input.artifactKey, artifactUrl: input.artifactUrl };
}


export async function recordProxyUpgradeFinding(input: { proxyAddress: string; implementation: string; reason: "UNAUTHORIZED_CALLER" | "IMPLEMENTATION_NOT_ALLOWLISTED" }) {
  const finding: IngestedFinding = {
    findingKey: keyFor(`PROXY-UPGRADE:${input.proxyAddress}:${input.implementation}:${input.reason}`),
    severity: "CRITICAL",
    category: "Upgrade authorization",
    component: input.proxyAddress,
    status: "OPEN",
    expectedBehavior: "Only an authorized operator may upgrade to an allowlisted implementation",
    actualBehavior: `${input.reason}: attempted implementation ${input.implementation}`,
    locations: [{ physicalLocation: { artifactLocation: { uri: "automation/fixtures/UpgradeableProxy.sol" }, region: { startLine: 1, startColumn: 1 } } }],
  };
  await persistFinding(finding);
  return finding;
}
