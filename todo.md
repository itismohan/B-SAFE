# Project TODO

- [x] Enterprise dashboard with overall security score, quality metrics, blockchain metrics, and security metrics
- [x] CAD blueprint visual system with royal-blue grid background, technical frames, dimension markers, and high-contrast typography
- [x] Real-time execution terminal surface with timestamps, severity labels, searchable and filterable event stream, transaction hashes, block numbers, and status updates
- [x] Test run management flow with risk selection using CRITICAL, HIGH, MEDIUM, and LOW labels
- [x] Parallel execution toggle and per-run isolation indicators for ephemeral wallets and synthetic assets
- [x] Modular test engine UI for Smart Contract, Blockchain Transaction, Wallet Security, API Security, Asset Lifecycle, Reconciliation, Fuzzing, and Chaos/Failure Injection suites
- [x] Configurable suite parameters and visible pass/fail/running status for each modular test suite
- [x] Security findings panel with structured finding fields, severity, attack scenario, expected versus actual behavior, impact, evidence, and remediation
- [x] Asset lifecycle visualization using the exact sequence Creation, Registration, Tokenization, Ownership, Transfer, Settlement, Custody, Valuation, Redemption, Burn
- [x] Reconciliation visualization using the exact layers Blockchain, Smart Contract, Application DB, Asset Ledger, and Reporting System
- [x] Risk-based test orchestration with explicit security gates and severity-aware prioritization
- [x] Compliance and audit reporting surfaces with OWASP, CWE, NIST, SOC 2, and ISO 27001 references
- [x] Report format options labeled HTML, JSON, JUnit, and SARIF
- [x] RBAC-aware access surface for admin and analyst roles with secure-session and audit-log presentation
- [x] Backend data contracts and persistence for test runs, findings, audit events, metrics, and suite configuration
- [x] Vitest coverage for core dashboard data and test-run workflows
- [x] Responsive visual verification for desktop and mobile layouts
- [x] Final release checkpoint after all completed items are marked done
- [x] Wire dashboard metrics, terminal events, findings, and test runs to backend procedures with loading, error, and empty states
- [x] Implement live execution streaming through a backend event source instead of static log fixtures
- [x] Add per-suite configuration controls and persisted test-run management/history
- [x] Build compliance and reporting UI with exact OWASP, CWE, NIST, SOC 2, ISO 27001 references and HTML, JSON, JUnit, SARIF options
- [x] Implement RBAC-aware admin/analyst experiences with secure-session and audit-log surfaces
- [x] Add Vitest coverage for dashboard and test-run workflows
- [x] Capture mobile visual verification evidence
- [x] Add durable persistence and query helpers for security findings, dashboard metrics, and suite configuration/history
- [x] Load dashboard snapshot data from persisted storage instead of in-memory arrays for runs, findings, audit events, and metrics
- [x] Persist per-suite configuration selections and expose them through tRPC procedures to the UI

# Automation Framework Extension

- [x] Define the blockchain-agnostic adapter interfaces for network, wallet, transaction, contract, event, block, ledger, asset, oracle, and scanner integrations
- [x] Add the DISCOVER → MODEL → GENERATE → EXECUTE → OBSERVE → VERIFY → ATTACK → RECONCILE → ANALYZE → REPORT execution pipeline
- [x] Add threat-model, test-case, evidence, finding, and reconciliation domain models
- [x] Add deterministic cryptographic and transaction verification utilities with secret-safe logging
- [x] Add modular test-suite registry for Smart Contract, Blockchain Transaction, Wallet Security, API Security, Asset Lifecycle, Reconciliation, Fuzzing, and Chaos/Failure Injection
- [x] Add EVM adapter contracts and safe placeholder implementations without hardcoded credentials or private keys
- [x] Add automation runner, lifecycle state machine, retries, timeouts, isolation, and evidence collection contracts
- [x] Add report serializers for HTML, JSON, JUnit, and SARIF evidence packages
- [x] Add unit tests for pipeline ordering, business-valid transaction rules, severity labels, and secret redaction
- [x] Add automation framework documentation with folder structure, configuration, extension points, and execution examples

# Controlled EVM Network Integration

- [x] Add safe Anvil/Hardhat-compatible RPC configuration without hardcoded credentials or private keys
- [x] Add injected JSON-RPC EVM client implementation for chain, block, transaction, receipt, and raw transaction operations
- [x] Add network health and chain-ID safety checks that reject non-local networks by default
- [x] Add ephemeral wallet provider and controlled transaction submission support
- [x] Add realistic local-network integration tests for block number, funded account, transaction hash, receipt, and confirmation status
- [x] Add local-network start/stop scripts and operator documentation for Anvil or Hardhat
- [x] Validate all unit and integration tests, then save a checkpoint

# Contract Fixtures, Reconciliation, and CI Extension

- [x] Add controlled ERC-20 and ERC-721 Solidity fixtures with deployment helpers
- [x] Add ERC-20 mint, transfer, approval, and balance lifecycle scenario
- [x] Add ERC-721 mint, approval, transfer, ownership, and tokenURI lifecycle scenario
- [x] Add ABI-based event-log decoding for Transfer, Approval, and ownership events
- [x] Add independent ERC-20/ERC-721 contract-state reconciliation against decoded receipts
- [x] Add Hardhat pull-request CI workflow with local node startup, integration tests, and artifact capture
- [x] Add integration tests covering both token lifecycles, decoded events, and reconciliation failures
- [x] Validate all tests and save a checkpoint

# ERC-1155, Proxy, Evidence, and Nightly CI Extension

- [x] Add a controlled ERC-1155 Solidity fixture with mint, batch mint, transfer, and balance lifecycle support
- [x] Add a controlled upgradeable-proxy fixture with implementation upgrade and state-preservation checks
- [x] Add deployment and ABI helpers for ERC-1155 and upgradeable proxy scenarios
- [x] Add ERC-1155 and proxy integration scenarios with decoded event assertions
- [x] Add event-to-ledger reconciliation models and comparison logic for token movements
- [x] Persist reconciliation evidence records through the existing B-SAFE control-plane database service
- [x] Add nightly CI schedule with retained SARIF and JUnit reports alongside Hardhat logs
- [x] Validate unit and integration coverage and save a checkpoint

# Batch Reconciliation, Proxy Governance, and Report Publication Extension

- [x] Add ERC-1155 batch event-to-ledger normalization and reconciliation assertions
- [x] Add proxy implementation allowlist storage and upgrade enforcement to the controlled fixture
- [x] Add explicit unauthorized upgrade and non-allowlisted implementation findings
- [x] Add report-ingestion service for nightly SARIF and JUnit artifacts into persisted security findings
- [x] Add dashboard query mapping for ingested CI findings and report metadata
- [x] Add integration and unit tests for batch mismatches, blocked upgrades, and report ingestion
- [x] Validate all flows and save a checkpoint

# Verification Gap Closure

- [x] Add ERC-1155 batch reconciliation tests deriving expected and observed movements from decoded batch events
- [x] Automatically persist findings when proxy upgrades are blocked by caller authorization or implementation allowlists
- [x] Persist nightly report metadata including source, format, generatedAt, artifact path, and run ID
- [x] Expose nightly report metadata through dashboard snapshot/query data
- [x] Add end-to-end evidence-ingestion persistence coverage for SARIF and JUnit findings
- [x] Revalidate all gap closures and save a checkpoint

# Final Gap Closure

- [x] Wire blocked proxy upgrade paths to automatically persist security findings for unauthorized callers and non-allowlisted implementations
- [x] Expose nightly report metadata fields through dashboard snapshot/query data consumed by the UI
- [x] Add persistence-level ingestion coverage proving SARIF/JUnit findings surface through dashboard data
- [x] Save a fresh checkpoint after final validation

# Production Wiring Gap Closure

- [x] Add a production proxy governance service that invokes recordProxyUpgradeFinding for unauthorized callers and non-allowlisted implementations
- [x] Render nightly report metadata from the dashboard snapshot in the Evidence and reports UI
- [x] Add an automated persistence test for report ingestion and dashboard snapshot visibility
- [x] Save a final checkpoint after production wiring validation

# Post-Release Enhancements

- [x] Add authenticated end-to-end tests for the protected proxy-governance tRPC mutation
- [x] Add a dedicated report-history detail view with filtering by run ID, format, and source
- [x] Enable and validate live Hardhat integration scenarios in CI

# Verification Hardening

- [x] Add HTTP-level authenticated integration coverage for the protected proxy-governance tRPC transport
- [x] Add a committed CI assertion that fails when live Hardhat integration suites are skipped

# Report History and Browser Verification Enhancements

- [x] Add paginated report history with artifact download links
- [x] Add SARIF location metadata and CI annotations for blocked proxy findings
- [x] Add browser-level tests for report-history filtering and modal accessibility

# Production Evidence Hardening

- [x] Serve retained report artifacts through a verifiable download endpoint and test a real browser download
- [x] Add source locations to real automation proxy-governance findings
- [x] Publish SARIF to CI annotations and verify blocked proxy locations in the emitted report

# Final SARIF Verification

- [x] Verify a real blocked automation proxy finding flows through serializeReport into SARIF with its source region

# Evidence Operations Enhancements

- [x] Add S3-backed signed URLs for report artifacts in multi-instance deployments
- [x] Add report-history retention and deletion policies with audit events
- [x] Add GitHub SARIF annotation tests against a minimal workflow fixture

# Retention Audit Verification

- [x] Add end-to-end pruning coverage for expired reports and deletion counts
- [x] Preserve report-deletion tombstones in dashboard audit history while hiding deleted report entries
- [x] Assert retention and deletion audit events surface through the dashboard snapshot

# Portal Branding Update

- [x] Apply the supplied B-SAFE logo to the dashboard brand mark and portal favicon/app metadata
- [x] Verify the supplied logo remains legible and correctly scaled on desktop and mobile layouts

# Branding Verification Hardening

- [x] Wire the supplied logo into the project app-logo metadata/config surface
- [x] Add browser assertions for logo visibility and responsive dimensions on desktop and mobile

# Circular Logo Refinement

- [x] Make the supplied B-SAFE logo frame circular while keeping the complete logo visible without cropping
- [x] Verify circular logo containment and responsive sizing on desktop and mobile

# Sidebar Brand Simplification

- [x] Remove the separate B-SAFE and SECURITY SYSTEMS text from the sidebar brand lockup
- [x] Enlarge the complete circular logo while preserving responsive containment

# Testing Documentation

- [x] Add comprehensive testing documentation for services, UI, blockchain contracts, local Hardhat, CI, and test-case authoring

# Browser and CI Quality Gates

- [x] Add a documented Playwright report-history filtering interaction test
- [x] Configure pull-request CI to run type, unit/service, browser, live Hardhat, and coverage-threshold suites

# Primary Navigation Views

- [x] Add dedicated views for Command center, Test runs, Test engine, Findings, Reconciliation, and Evidence & reports
- [x] Wire primary sidebar clicks to render the selected dedicated view and preserve responsive layout
- [x] Add browser coverage for primary sidebar view switching and active navigation state

# Execution CTA and Results

- [x] Enhance New Test Run and Critical Run CTA hierarchy and launch feedback
- [x] Add a dedicated execution-results view showing progress, outcomes, findings, and evidence actions
- [x] Add browser coverage for launching a Critical Run and viewing execution results

# Execution Results Hardening

- [x] Wire run CTA state to the real createRun mutation lifecycle with loading, success, disabled, and failure states
- [x] Drive execution-results progress and outcomes from persisted or streamed execution data instead of synthetic timer values
- [x] Add regression coverage for failed run launches and real execution-result rendering

# Execution Results Persistence Closure

- [x] Generate and apply the `test_runs.progress` and `test_runs.resultMetadata` schema migration
- [x] Extend test-run persistence and update helpers to store execution progress and result metadata
- [x] Persist backend-owned execution lifecycle transitions and expose them through dashboard snapshots
- [x] Hydrate the Test Runs execution panel from persisted snapshot state on navigation/reload
- [x] Add regression coverage for queued-to-sealed execution result persistence

# Execution Orchestration and Run Control Enhancements

- [x] Replace controlled lifecycle timers with callbacks emitted by the automation runner
- [x] Persist execution phase, attempt, cancellation, and resumability state for test runs
- [x] Add paginated persisted run-history queries and run-detail retrieval
- [x] Add run-detail navigation from Test Runs history
- [x] Add cancellation, retry, and resumable execution procedures and UI controls
- [x] Add unit, service, HTTP, and browser regression coverage for run controls
- [x] Validate all quality gates and save a checkpoint

# Control Plane / New Run UI Enhancement

- [x] Refine the New Run modal hierarchy, copy, and blueprint styling
- [x] Improve risk/profile selection clarity and launch readiness feedback
- [x] Preserve accessible modal interactions and existing run-launch behavior
- [x] Validate the enhanced launch flow visually and functionally
- [x] Save a checkpoint for the UI enhancement

# Local Setup Documentation

- [x] Update README.md with local dashboard, automation runner, Hardhat, testing, evidence, troubleshooting, and Git instructions
- [x] Validate the updated README and repository diff

# Deployment Health and Workflow Badge Fixes

- [x] Update SARIF upload to CodeQL Action v4 and avoid failing fork pull requests without code-scanning write access
- [x] Add appropriate CI and release status badges below the B-SAFE logo in README.md
- [x] Resize the repository logo asset for efficient README rendering
- [x] Run local health and workflow validation, then push the fixes

# GitHub Actions pnpm Bootstrap Fix

- [x] Initialize pnpm before setup-node attempts pnpm caching
- [x] Validate the corrected workflow and push it to main

# GitHub Actions pnpm Version Conflict Fix

- [x] Use package.json packageManager as the single pnpm version authority
- [x] Validate the corrected workflow and push it to main
