# B-SAFE Automation Framework

The `automation/` package is a blockchain-agnostic quality-engineering and cybersecurity automation layer for the B-SAFE control plane. It is designed around independent verification: a transaction is not business-valid merely because it was accepted or mined.

## Folder structure

```text
automation/
├── README.md
├── src/
│   ├── adapters/
│   │   ├── interfaces.ts
│   │   └── evm.ts
│   ├── engine/
│   │   ├── pipeline.ts
│   │   ├── registry.ts
│   │   └── runner.ts
│   ├── verification/
│   │   ├── crypto.ts
│   │   ├── transactions.ts
│   │   └── redaction.ts
│   ├── reporting/
│   │   └── serializers.ts
│   ├── models.ts
│   └── index.ts
└── tests/
    └── pipeline.test.ts
```

The adapters isolate network-specific behavior. The engine owns orchestration and lifecycle ordering. Verification performs independent checks. Reporting serializes technical evidence without presenting it as a formal compliance claim.

## Lifecycle

`DISCOVER → MODEL → GENERATE → EXECUTE → OBSERVE → VERIFY → ATTACK → RECONCILE → ANALYZE → REPORT`

All execution contexts must use isolated environments, ephemeral wallets, synthetic assets, least-privilege credentials, bounded timeouts, and secret-safe evidence handling. The package deliberately contains no private keys, seed phrases, production RPC URLs, or hard-coded credentials.

## Example

```ts
import { createDefaultRunner } from "./src";

const result = await createDefaultRunner().run({
  runId: "RUN-LOCAL-001",
  risk: "HIGH",
  suites: ["Blockchain Transaction", "Reconciliation"],
  target: "synthetic-asset-10291",
});

console.log(result.summary);
```

## Configuration and extension points

Inject adapters from the application boundary rather than reading secrets inside the framework. A production runner should receive an `EvmClient`, wallet provider, contract client, ledger client, and reconciliation adapter through dependency injection. RPC URLs and credentials belong in the project secret manager and must never be written to test cases, logs, fixtures, or reports.

To add a blockchain, implement `BlockchainAdapter`, `TransactionAdapter`, and `BlockAdapter`, then compose them into an adapter bundle without changing `AutomationRunner`. To add a test suite, implement `TestSuite`, register it in `SuiteRegistry`, and emit only redacted evidence through the supplied context. Suites should be deterministic where possible, bounded by the runner timeout, and written against synthetic targets.

The default EVM skeleton uses chain ID `31337` as a local isolated-network convention. It does not create wallets, connect to an RPC endpoint, or sign transactions by itself; those capabilities must be injected explicitly by a controlled test environment.

## Controlled Hardhat workflow

Start the local network with `pnpm evm:node`; it binds to `127.0.0.1:8545`, exposes chain ID `31337`, and provides disposable funded accounts from Hardhat’s local node. Run the integration test with `pnpm test:evm`. Stop the foreground process with `Ctrl-C`, or terminate the process from the terminal session that started it. The adapter rejects non-local RPC hosts unless `BSAFE_ALLOW_NONLOCAL_RPC=true` is explicitly set and verifies the expected chain ID before health is reported.

The integration test validates local chain health, block retrieval, funded-account balance, unlocked-account funding of an ephemeral wallet, scoped message signing and verification, ephemeral-wallet transaction submission, transaction hash lookup, receipt confirmation, and cleanup of the ephemeral signer.

## Pull-request CI

`.github/workflows/hardhat.yml` runs on pull requests and pushes to `main`. It installs the pinned toolchain, compiles the Solidity fixtures, starts Hardhat on the loopback interface, waits for chain ID `31337`, runs unit and type checks, runs the EVM and token lifecycle integration tests, and uploads `hardhat.log` plus compiled artifacts for debugging and evidence review. No production network, wallet, or secret is used by this workflow.

## Extended fixtures and persisted evidence

The controlled fixture set now includes ERC-1155 single and batch transfers plus a minimal upgradeable counter proxy. The proxy test verifies implementation upgrades while preserving state in dedicated proxy storage slots. Event-to-ledger evidence is persisted in the `reconciliation_evidence` table through the protected `dashboard.persistReconciliation` procedure and can be queried through `dashboard.reconciliationEvidence`.

The CI workflow runs on pull requests, `main` pushes, and nightly at 02:17 UTC. Nightly runs generate `reports/bsafe.sarif`, `reports/bsafe.junit.xml`, `reports/bsafe.json`, and `reports/bsafe.html`, retaining the evidence artifact for 30 days together with Hardhat logs and compiled fixture artifacts.
