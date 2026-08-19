import { readFile } from "node:fs/promises";
import { ingestNightlyReport, publishReportArtifact } from "../../server/reportIngestion";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not configured; evidence remains available as CI artifacts and ingestion is skipped.");
  process.exit(0);
}

const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;
const sarifContent = await readFile("reports/bsafe.sarif", "utf8");
const junitContent = await readFile("reports/bsafe.junit.xml", "utf8");
const [sarifArtifact, junitArtifact] = await Promise.all([
  publishReportArtifact({ runId, format: "SARIF", content: sarifContent }),
  publishReportArtifact({ runId, format: "JUnit", content: junitContent }),
]);
const sarif = await ingestNightlyReport({ runId, format: "SARIF", artifactPath: "reports/bsafe.sarif", artifactKey: sarifArtifact.key, artifactUrl: sarifArtifact.url, content: sarifContent });
const junit = await ingestNightlyReport({ runId, format: "JUnit", artifactPath: "reports/bsafe.junit.xml", artifactKey: junitArtifact.key, artifactUrl: junitArtifact.url, content: junitContent });
console.log(`Published ${sarif.ingested + junit.ingested} nightly findings to the B-SAFE control plane.`);
