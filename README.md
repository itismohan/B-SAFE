[![CI](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml/badge.svg)](https://github.com/itismohan/B-SAFE/actions/workflows/hardhat.yml)
[![Release](https://img.shields.io/github/v/release/itismohan/B-SAFE?label=release)](https://github.com/itismohan/B-SAFE/releases)
[![Stars](https://img.shields.io/github/stars/itismohan/B-SAFE?style=social)](https://github.com/itismohan/B-SAFE/stargazers)


![B-SAFE Logo](assets/bsafe-logo.png)

# B-SAFE Blockchain Security Testing Framework

B-SAFE is a security-first, blockchain-agnostic testing framework with a React control-plane dashboard, a TypeScript automation engine, controlled Hardhat/EVM fixtures, independent reconciliation, [...]

## Testing and contribution documentation

Read **[TESTING.md](./TESTING.md)** for the complete guide to local setup, service and tRPC tests, HTTP transport coverage, UI/browser tests, Hardhat contract integration tests, provider mocking, r[...]

The principal test commands are:

```bash
pnpm check
pnpm test
pnpm test:browser
pnpm evm:node
pnpm test:evm:ci
```

Run `pnpm evm:node` in one terminal before executing live EVM tests. The no-skip runner requires all five live scenarios to pass and fails if any scenario is skipped.
