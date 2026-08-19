# B-SAFE Blockchain Security Testing Framework

B-SAFE is a security-first, blockchain-agnostic testing framework with a React control-plane dashboard, a TypeScript automation engine, controlled Hardhat/EVM fixtures, independent reconciliation, SARIF/JUnit evidence, and CI integration.

## Testing and contribution documentation

Read **[TESTING.md](./TESTING.md)** for the complete guide to local setup, service and tRPC tests, HTTP transport coverage, UI/browser tests, Hardhat contract integration tests, provider mocking, report evidence, GitHub Actions, troubleshooting, and adding new test cases.

The principal test commands are:

```bash
pnpm check
pnpm test
pnpm test:browser
pnpm evm:node
pnpm test:evm:ci
```

Run `pnpm evm:node` in one terminal before executing live EVM tests. The no-skip runner requires all five live scenarios to pass and fails if any scenario is skipped.
