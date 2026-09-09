<div align="center">

![B-SAFE Logo](assets/bsafe-logo.png)


<p><strong>B-SAFE</strong> — Blockchain Security, Assurance & Financial Engineering</p>

</div>

[![CI](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml/badge.svg)](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml) [![Release](https://img.shields.io/github/v/release/itismohan/B-SAFE?label=release)](https://github.com/itismohan/B-SAFE/releases) [![License: MIT](https://img.shields.io/github/license/itismohan/B-SAFE)](./LICENSE)

# B-SAFE Blockchain Security Testing Framework

Marketplace / registry description: A security-first, blockchain-agnostic testing framework for independent assurance of smart-contracts and digital-asset infrastructure.

Short description: A security-first, blockchain-agnostic testing framework for independent assurance of smart-contract and digital-asset infrastructure.

B-SAFE is a security-first, blockchain-agnostic testing framework that provides a React control-plane dashboard, a TypeScript automation engine, controlled Hardhat/EVM fixtures, and independent reconciliation and evidence tooling. It provides an independent assurance layer for digital-asset infrastructure by exercising smart-contract and asset lifecycles, validating authorization and state transitions, comparing on-chain and off-chain state, and producing reproducible findings and evidence packages.

> Note: Some badges (coverage, Snyk, release) will show as 'unknown' or a placeholder until the corresponding service has run at least once (CI run, Codecov upload, Snyk enabled, or a GitHub Release created). Run the CI workflow on `main` to populate coverage and build artifacts.

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
