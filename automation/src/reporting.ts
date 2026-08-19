import type { RunResult } from "./models";

const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const toJson = (result: RunResult) => JSON.stringify(result, null, 2);

export const toJunit = (result: RunResult) => {
  const failures = result.findings.length;
  return `<testsuite name="B-SAFE" tests="${result.stages.length}" failures="${failures}">${result.stages.map(stage => `<testcase classname="B-SAFE.pipeline" name="${stage}"${failures ? `><failure message="${esc(result.summary)}" /></testcase>` : " />"}`).join("")}</testsuite>`;
};

export const toSarif = (result: RunResult) => JSON.stringify({ version: "2.1.0", runs: [{ tool: { driver: { name: "B-SAFE Automation Framework" } }, results: result.findings.map(finding => ({ ruleId: finding.id, level: finding.severity === "CRITICAL" || finding.severity === "HIGH" ? "error" : "warning", message: { text: finding.actual }, locations: (finding.locations?.length ? finding.locations : [{ uri: finding.component }]).map(location => ({ physicalLocation: { artifactLocation: { uri: location.uri }, ...(location.startLine || location.startColumn ? { region: { startLine: location.startLine, startColumn: location.startColumn } } : {}) } })) })) }] }, null, 2);

export const toHtml = (result: RunResult) => `<!doctype html><html><head><meta charset="utf-8"><title>B-SAFE Evidence ${esc(result.runId)}</title></head><body><h1>B-SAFE technical test evidence</h1><p>Run: ${esc(result.runId)} · Status: ${esc(result.status)}</p><p>${esc(result.summary)}</p><h2>Findings</h2><ul>${result.findings.map(finding => `<li><strong>${esc(finding.severity)} · ${esc(finding.id)}</strong> ${esc(finding.actual)}</li>`).join("")}</ul><p>This package contains technical test evidence and is not a formal compliance claim.</p></body></html>`;

export const serializeReport = (format: "HTML" | "JSON" | "JUnit" | "SARIF", result: RunResult) => ({ HTML: toHtml, JSON: toJson, JUnit: toJunit, SARIF: toSarif }[format])(result);
