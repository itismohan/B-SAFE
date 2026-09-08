<div align="center">

![B-SAFE Logo](assets/bsafe-logo.png)


<p><strong>B-SAFE</strong> — Blockchain Security, Assurance & Financial Engineering</p>

</div>

[![CI](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml/badge.svg)](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml) [![Release](https://img.shields.io/github/v/release/itismohan/B-SAFE?label=release)](https://github.com/itismohan/B-SAFE/releases) [![License: MIT](https://img.shields.io/github/license/itismohan/B-SAFE)](./LICENSE)

# B-SAFE Blockchain Security Testing Framework

B-SAFE is a security-first, blockchain-agnostic testing framework that provides a React control-plane dashboard, a TypeScript automation engine, controlled Hardhat/EVM fixtures, and independent reconciliation and evidence tooling. It provides an independent assurance layer for digital-asset infrastructure by exercising smart-contract and asset lifecycles, validating authorization and state transitions, comparing on-chain and off-chain state, and producing reproducible findings and evidence packages.

## What is included

This repository contains the main components used to run B-SAFE end-to-end and in CI:

- `client/` — CAD-blueprint React dashboard (control-plane UI)
- `server/` — Backend control-plane services and tRPC procedures
- `automation/src/` — Blockchain adapters, domain models, and TypeScript automation engine
- `automation/tests/` — Unit, integration and EVM integration tests for the automation engine
- `contracts/` or `solidity/` — Solidity fixtures and contracts used for controlled EVM tests
- `drizzle/schema.ts` — Drizzle ORM schema definitions and migrations
- `TESTING.md` — Detailed testing and CI guidance

The dashboard includes the Command Center, Test Runs, Test Engine, Findings, Reconciliation, and Evidence & Reports views. Test Runs supports persisted history, run details, execution progress, cancellation, and artifact downloads. The automation engine supports callback-driven orchestration, cancellation, retry, and resumable stage execution.

Read `TESTING.md` for the complete guide to service and tRPC tests, HTTP transport coverage, UI/browser tests, Hardhat contract integration tests, provider mocking, report evidence, and CI configuration.

## Prerequisites

- Node.js 22 or newer
- pnpm (package manager)
- Git
- A MySQL-compatible database (MySQL, MariaDB, TiDB)
- Playwright browser binaries (for browser tests)

Verify the basic tools:

```bash
node --version
pnpm --version
git --version
```

## Install the project

Clone the repository and install dependencies:

```bash
git clone https://github.com/itismohan/B-SAFE.git
cd B-SAFE
pnpm install
```

The project uses TypeScript, React, Vitest, Playwright, Hardhat, viem, Express, tRPC, Drizzle ORM, and a MySQL/TiDB-compatible database.

## Configure environment variables

The full-stack dashboard requires a reachable database via `DATABASE_URL`. If available, copy the environment template and set the required variables locally (do not commit secrets):

```bash
cp .env.example .env
```

At minimum, set a valid `DATABASE_URL` that points to a local or hosted MySQL/TiDB-compatible instance. Optionally configure authentication providers, OAuth credentials, object storage, and any application-specific variables required by your deployment. Do not commit `.env` or any secret files to the repository.

If the dashboard starts but database-backed features fail, verify connectivity and credentials and inspect server logs for detailed errors.

## Start the B-SAFE dashboard (development)

Run the development server:

```bash
pnpm dev
```

Open the dashboard at:

```
http://localhost:3000
```

The dashboard provides the CAD-blueprint control plane, New Run flow, execution results, Test Runs history, Findings, Reconciliation, Evidence & Reports, and the real-time execution stream. Stop the server with Ctrl+C.

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

To run a focused browser test:

```bash
pnpm exec playwright test browser-tests/execution-cta.spec.ts
```

## Run live Hardhat automation (local EVM)

Start the controlled local EVM node in one terminal:

```bash
pnpm evm:node
```

The node listens on `127.0.0.1:8545`. Leave this terminal running. In a second terminal, run:

```bash
pnpm test:evm
```

For CI-equivalent validation that fails on skipped scenarios, use:

```bash
pnpm test:evm:ci
```

If you run live Vitest files manually, set the integration flag explicitly:

```bash
BSAFE_EVM_INTEGRATION=true pnpm vitest run automation/tests
```

## Generate and ingest evidence

Generate HTML, JSON, JUnit, and SARIF evidence packages:

```bash
pnpm evidence:generate
```

Ingest and publish evidence metadata and artifacts:

```bash
pnpm evidence:ingest
```

Evidence metadata may include the source, format, run ID, retention or expiration timestamps, artifact references, findings, and SARIF source locations. Review generated artifacts before committing or publishing evidence.

## Database schema changes

The project uses Drizzle ORM. To make schema changes:

1. Update `drizzle/schema.ts` with the new table/column definitions.
2. Generate a migration and inspect the SQL:

```bash
pnpm drizzle-kit generate
```

3. Apply the migration or use `pnpm db:push` with care. Always ensure the target database is backed up or disposable before applying destructive changes.

```bash
pnpm db:push
```

Only run migration commands when the schema change is intentional and reviewed.

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

If the repository has no commits yet, the first push will fail until `git add` and `git commit` are completed. Review `git status` before committing so that generated artifacts and local environment files are excluded as needed.

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.

## Further documentation

- `TESTING.md` — detailed test architecture, test authoring, mocking, browser validation, Hardhat integration, CI, evidence, and troubleshooting
- `.github/workflows/` — pull-request, Hardhat, nightly, evidence, and artifact-retention workflows
- `automation/src/engine.ts` — callback-driven orchestration, cancellation, retry, and resumable stage execution
- `server/dashboard.ts` — dashboard run lifecycle, persistence, history, and run-control behavior
- `client/src/pages/Home.tsx` — control-plane views and the New Run experience
