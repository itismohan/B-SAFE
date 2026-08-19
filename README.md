<div align="center">

![B-SAFE Logo](assets/bsafe-logo.png)

</div>

[![CI](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml/badge.svg)](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml) [![Release](https://img.shields.io/github/v/release/itismohan/B-SAFE?style=flat)](https://github.com/itismohan/B-SAFE/releases) [![License](https://img.shields.io/github/license/itismohan/B-SAFE?style=flat)](LICENSE)

# B-SAFE Blockchain Security Testing Framework

B-SAFE is a security-first, blockchain-agnostic testing framework with a React control-plane dashboard, a TypeScript automation engine, controlled Hardhat/EVM fixtures, independent reconciliation, and a comprehensive evidence and reporting system designed to validate asset-lifecycle security and smart-contract behavior.

The framework provides an independent assurance layer for digital-asset infrastructure. It exercises smart-contract and asset lifecycles, validates authorization and state transitions, compares on-chain and off-chain records, and issues security findings with forensic evidence.

## What is included

The repository contains the CAD-blueprint dashboard under `client/`, backend control-plane procedures under `server/`, blockchain adapters and domain models under `automation/src/`, Solidity fixtures under `contracts/`, and browser-based UI and accessibility tests under `browser-tests/`.

The dashboard includes the Command Center, Test Runs, Test Engine, Findings, Reconciliation, and Evidence & Reports views. Test Runs supports persisted history, run details, execution progress, cancellation, and integration with blockchain networks.

Read [TESTING.md](./TESTING.md) for the complete guide to service and tRPC tests, HTTP transport coverage, UI/browser tests, Hardhat contract integration tests, provider mocking, report evidence, ingestion, and troubleshooting.

## Prerequisites

Install **Node.js 22 or newer**, **pnpm**, **Git**, and a MySQL/TiDB-compatible database. Playwright browser binaries are also required for browser tests.

Verify the basic tools:

```bash
node --version
pnpm --version
git --version
```

## Install the project

From the repository root:

```bash
cd /Users/mohankrishnagundala/Documents/BSAFE
pnpm install
```

If you cloned the repository somewhere else, use that directory instead. The project uses TypeScript, React, Vitest, Playwright, Hardhat, viem, Express, tRPC, Drizzle ORM, and MySQL/TiDB-compatible drivers to provide end-to-end security automation, verification, and reporting.

## Configure environment variables

The full-stack dashboard expects a reachable database through `DATABASE_URL`. The managed B-SAFE environment injects authentication, OAuth, storage, and application variables automatically. A standalone or self-hosted deployment may require explicit configuration.

If the repository includes an environment template, copy it without committing secrets:

```bash
cp .env.example .env
```

Then configure at least a valid local or hosted MySQL/TiDB-compatible `DATABASE_URL`. Do not commit `.env`, `.env.local`, or any credential file. If the dashboard starts but database-backed features do not work, verify that the `DATABASE_URL` is valid, reachable, and provisioned with the latest schema.

## Start the B-SAFE dashboard

Run the development server:

```bash
pnpm dev
```

Open the dashboard at:

```text
http://localhost:3000
```

The dashboard provides the CAD-blueprint control plane, New Run flow, execution results, Test Runs history, Findings, Reconciliation, Evidence & Reports, and the real-time execution stream. Stop the development server with `Ctrl+C`.

## Run the automation unit and service suites

Run TypeScript validation first:

```bash
pnpm check
```

Run the default Vitest suite:

```bash
pnpm test
```

The default suite covers automation pipeline behavior, dashboard services, persistence contracts, protected procedures, HTTP transport, evidence handling, and other non-live regression cases.

Run the coverage-enforced quality gate:

```bash
pnpm test:coverage
```

## Run browser tests

Install Playwright browser binaries once per development machine:

```bash
pnpm exec playwright install
```

Then run the browser suite:

```bash
pnpm test:browser
```

Browser coverage includes primary navigation, branding, the New Run launch flow, execution results, report-history filtering, pagination, artifact downloads, run-history controls, modal accessibility, and interactive UI validation.

To run a focused browser test:

```bash
pnpm exec playwright test browser-tests/execution-cta.spec.ts
```

## Run live Hardhat automation

Start the controlled local EVM node in Terminal 1:

```bash
cd /Users/mohankrishnagundala/Documents/BSAFE
pnpm evm:node
```

The node listens on `127.0.0.1:8545`. Leave this terminal running. In Terminal 2, run:

```bash
pnpm test:evm
```

For the preferred CI-equivalent no-skip validation, use:

```bash
pnpm test:evm:ci
```

The no-skip runner enables live EVM integration automatically and fails unless all five expected scenarios execute successfully with zero skipped scenarios. The live scenarios cover controlled EVM execution, lifecycle transitions, permission validation, and contract upgrade behavior.

If you run live Vitest files manually, set the integration flag explicitly:

```bash
BSAFE_EVM_INTEGRATION=true pnpm vitest run automation/tests
```

## Generate and ingest evidence

Generate HTML, JSON, JUnit, and SARIF evidence packages:

```bash
pnpm evidence:generate
```

Exercise the evidence ingestion and publication path:

```bash
pnpm evidence:ingest
```

Evidence metadata can include the source, format, run ID, retention or expiration timestamps, artifact references, findings, and SARIF source locations. Review generated artifacts before committing to ensure sensitive content is excluded.

## Database schema changes

The project uses Drizzle ORM. Schema changes must be intentional and reviewed. Update `drizzle/schema.ts`, generate the migration, inspect the SQL, and apply it through the project's database workflow:

```bash
pnpm drizzle-kit generate
```

The repository also exposes:

```bash
pnpm db:push
```

Use database migration commands only when the schema change is understood and the target database is backed up or disposable. Do not use destructive SQL casually.

## Recommended validation sequences

For ordinary dashboard or backend changes:

```bash
pnpm check
pnpm test
pnpm test:coverage
pnpm test:browser
```

For changes affecting blockchain adapters, fixtures, lifecycle logic, reconciliation, or proxy governance:

```bash
pnpm check
pnpm test
pnpm test:coverage
pnpm test:browser
pnpm test:evm:ci
```

For report-generation or ingestion changes, also run:

```bash
pnpm evidence:generate
pnpm evidence:ingest
```

## Package script reference

| Command                  | Purpose                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| `pnpm dev`               | Start the local dashboard and backend development server                       |
| `pnpm check`             | Run the TypeScript compiler with `--noEmit`                                    |
| `pnpm test`              | Run the default Vitest unit and service suite                                  |
| `pnpm test:coverage`     | Run Vitest with V8 coverage and enforced thresholds                            |
| `pnpm test:browser`      | Run all Playwright browser and accessibility tests                             |
| `pnpm evm:node`          | Start the local Hardhat JSON-RPC node on `127.0.0.1:8545`                      |
| `pnpm test:evm`          | Run live EVM integration tests when Hardhat is already running                 |
| `pnpm test:evm:ci`       | Run the no-skip live Hardhat integration gate                                  |
| `pnpm evidence:generate` | Generate HTML, JSON, JUnit, and SARIF evidence                                 |
| `pnpm evidence:ingest`   | Ingest and publish evidence metadata and findings                              |
| `pnpm db:push`           | Generate and apply Drizzle migrations; use only for intentional schema changes |
| `pnpm build`             | Build the client and bundled server output                                     |
| `pnpm start`             | Start the production build after `pnpm build`                                  |

## Troubleshooting

| Symptom                                    | Likely cause                                              | Resolution                                                                       |
| ------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm: command not found`                  | pnpm is not installed or is not on `PATH`                 | Install pnpm and reopen the terminal                                             |
| Dashboard starts but data calls fail       | Missing or unreachable `DATABASE_URL`                     | Configure a valid MySQL/TiDB URL and restart `pnpm dev`                          |
| Port 3000 is already in use                | Another dashboard or Node process is running              | Stop the existing process before starting B-SAFE again                           |
| Playwright reports a missing browser       | Browser binaries are not installed                        | Run `pnpm exec playwright install`                                               |
| Live EVM tests are skipped                 | Hardhat is not running or integration mode is disabled    | Prefer `pnpm test:evm:ci`                                                        |
| Hardhat integration cannot connect         | The local node is not listening on `127.0.0.1:8545`       | Start `pnpm evm:node` and retry                                                  |
| `src refspec main does not match any`      | The local `main` branch has no commit                     | Run `git add .`, `git commit`, and then push                                     |
| `Unable to transform response from server` | The dashboard backend or database response is unavailable | Inspect development-server logs and verify authentication/database configuration |

## Commit and push the source

After the source is working locally:

```bash
git status
git add .
git commit -m "Update B-SAFE framework"
git push --set-upstream origin main
```

If the repository has no commits yet, the first push will fail until `git add` and `git commit` are completed. Review `git status` before committing so that generated artifacts, local environment, and credential files are excluded.

## Further documentation

- [TESTING.md](./TESTING.md) — detailed test architecture, test authoring, mocking, browser validation, Hardhat integration, CI, evidence, and troubleshooting
- `.github/workflows/` — pull-request, Hardhat, nightly, evidence, and artifact-retention workflows
- `automation/src/engine.ts` — callback-driven orchestration, cancellation, retry, and resumable stage execution
- `server/dashboard.ts` — dashboard run lifecycle, persistence, history, and run-control behavior
- `client/src/pages/Home.tsx` — control-plane views and the New Run experience
