# B-SAFE Testing Guide

B-SAFE is a security-first blockchain testing framework with three complementary test layers: deterministic unit tests, service and control-plane integration tests, and live blockchain/UI integration tests. The layers deliberately have different responsibilities. Unit tests should be fast and isolated; service tests should validate persistence, authorization, report ingestion, and HTTP contracts; live EVM tests should validate deployed Solidity fixtures and transaction behavior against a controlled Hardhat network; browser tests should validate visible portal behavior and accessibility.

> **Security principle:** Never treat a system-under-test event, response, or status flag as sufficient evidence by itself. Decode observations independently, compare them with an expected model, and verify resulting contract or database state through a separate read path.

## 1. Test architecture

The repository organizes tests by the boundary they verify.

| Layer | Location | Primary responsibility | Requires live Hardhat? |
|---|---|---|---:|
| Automation unit tests | `automation/tests/pipeline.test.ts` | Pipeline ordering, retries, timeouts, severity labels, secret redaction, reconciliation, and report serialization | No |
| EVM adapter unit tests | `automation/tests/evm.adapter.unit.test.ts` when added | Mocked RPC responses, chain safety, transaction formatting, receipt mapping | No |
| Service/control-plane tests | `server/*.test.ts` | tRPC procedures, RBAC, report ingestion, persistence, audit events, storage helpers, and HTTP transport | No, unless explicitly testing EVM behavior |
| Contract integration tests | `automation/tests/token-lifecycle.integration.test.ts` | ERC-20/ERC-721 deployment and lifecycle behavior | Yes |
| ERC-1155/proxy integration tests | `automation/tests/erc1155-proxy.integration.test.ts` | ERC-1155 batch movements, proxy upgrades, allowlists, and storage preservation | Yes |
| EVM/network integration tests | `automation/tests/evm.integration.test.ts` | Chain ID, blocks, transactions, receipts, funded accounts, and confirmation behavior | Yes |
| Browser tests | `browser-tests/*.spec.ts` | Dashboard rendering, filters, downloads, modal accessibility, branding, and responsive behavior | No, but the dev server must be running |
| CI contract tests | `server/ciAnnotations.test.ts` and `.github/workflows/fixtures/` | SARIF upload permissions, paths, categories, and annotation contracts | No |

The main implementation directories are also separated by concern. Solidity fixtures and deployment helpers live under `automation/fixtures/`; blockchain adapters and domain models live under `automation/src/`; backend control-plane procedures live under `server/`; browser-facing components live under `client/`; and GitHub workflows live under `.github/workflows/`.

## 2. Prerequisites

Install Node.js and pnpm in the versions supported by the repository, then install dependencies from the project root.

```bash
cd /home/ubuntu/bsafe-framework
pnpm install
```

The project uses TypeScript, Vitest, Playwright, Hardhat, viem, Express, tRPC, Drizzle, and MySQL/TiDB-compatible persistence. The local development server is started with:

```bash
pnpm dev
```

The dashboard is normally available on the project preview URL or at `http://localhost:3000` when running locally. Browser tests use the configured Playwright base URL and expect the development server to be reachable.

Before opening a pull request, run the static type check:

```bash
pnpm check
```

This must pass before interpreting any test result as valid. TypeScript failures can prevent tests or the dev server from exercising the code you intended to validate.

## 3. Test command reference

The following commands are the canonical commands defined in `package.json`.

| Command | What it runs | Typical use |
|---|---|---|
| `pnpm check` | TypeScript compiler with `--noEmit` | Run after every code change and before a checkpoint |
| `pnpm test` | All Vitest tests, excluding skipped live EVM tests unless their condition is enabled | Default unit and service regression suite |
| `pnpm test:coverage` | Vitest with V8 coverage and enforced thresholds | Pull-request quality gate and local coverage review |
| `pnpm test:browser` | All Playwright tests in `browser-tests/` | UI, accessibility, download, and responsive regression suite |
| `pnpm evm:node` | Hardhat JSON-RPC node on `127.0.0.1:8545` | Start a local controlled chain manually |
| `pnpm test:evm` | Three live EVM test files with `BSAFE_EVM_INTEGRATION=true` | Run live tests when Hardhat is already running |
| `pnpm test:evm:ci` | Committed no-skip live integration runner | CI and local validation of all five live scenarios |
| `pnpm evidence:generate` | Generate HTML, JSON, JUnit, and SARIF evidence packages | Produce an evidence bundle from automation results |
| `pnpm evidence:ingest` | Publish nightly evidence and ingest findings/metadata | Exercise the evidence publication path |
| `pnpm db:push` | Generate and apply Drizzle migrations | Use only when schema changes are intentional and reviewed |

A normal local validation sequence is:

```bash
pnpm check
pnpm test
pnpm test:browser
```

For changes that affect blockchain adapters, fixtures, lifecycle logic, or proxy governance, also run:

```bash
pnpm evm:node
pnpm test:evm:ci
```

The `test:evm:ci` runner starts Vitest with `BSAFE_EVM_INTEGRATION=true`, writes a JSON result to `artifacts/live-integration-vitest.json`, and fails unless exactly five scenarios pass with zero skipped tests. This is the preferred command because it prevents a green build that silently skipped the live scenarios.

## 4. Service and control-plane tests

Service tests should validate business contracts without requiring a browser. They commonly use the tRPC router caller directly, mocked HTTP transport, or the configured database persistence layer.

### 4.1 Testing a protected tRPC procedure

Use `appRouter.createCaller` with an explicit context. Define the user role deliberately so RBAC behavior is testable.

```ts
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const analystCaller = () => appRouter.createCaller({
  user: {
    id: 101,
    openId: "test-analyst",
    email: "analyst@example.com",
    name: "Test Analyst",
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

it("allows an authenticated operator to request a SARIF report", async () => {
  const result = await analystCaller().dashboard.requestReport("SARIF");
  expect(result).toEqual({ format: "SARIF", status: "QUEUED" });
});
```

For an unauthenticated case, pass `user: undefined` and assert the exact tRPC error contract:

```ts
const anonymousCaller = () => appRouter.createCaller({
  user: undefined,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

await expect(
  anonymousCaller().dashboard.enforceProxyUpgrade({
    proxyAddress: "0xproxy",
    caller: "0xcaller",
    admin: "0xadmin",
    implementation: "0ximpl",
    allowlisted: false,
  }),
).rejects.toMatchObject({ code: "UNAUTHORIZED" });
```

For administrator-only operations such as report deletion and pruning, create an `admin` context and separately assert that an analyst receives `FORBIDDEN`. Do not test only the successful role; authorization regressions are often caused by missing negative cases.

### 4.2 Testing HTTP-level tRPC transport

Use `server/proxyGovernance.http.test.ts` as the pattern when the concern is the actual HTTP boundary rather than the in-process router caller. The test should verify the status code and the serialized tRPC error shape. This catches middleware, cookie, context, and adapter regressions that direct callers do not catch.

A complete HTTP test normally performs the following actions:

1. Start or reuse the Express application used by the test harness.
2. Send a request to the `/api/trpc/...` endpoint.
3. Include the authentication cookie or test context for the authenticated case.
4. Assert `401` or the serialized unauthorized code for the anonymous case.
5. Assert the successful response and persisted finding for the authenticated blocked-upgrade case.

### 4.3 Testing persistence and audit behavior

Persistence-level tests belong in `server/dashboard.test.ts` or a focused server test file. For report ingestion, use a unique run ID so records from parallel test execution cannot collide.

```ts
const runId = `TEST-SARIF-${Date.now()}`;
const { ingestNightlyReport } = await import("./reportIngestion");

await ingestNightlyReport({
  runId,
  format: "SARIF",
  artifactPath: "reports/test.sarif",
  content: JSON.stringify({
    version: "2.1.0",
    runs: [{ results: [{
      ruleId: "PROXY-UPGRADE",
      level: "error",
      message: { text: "implementation not allowlisted" },
      locations: [],
    }] }],
  }),
});

const snapshot = await caller().dashboard.snapshot();
expect(snapshot.audit.some(event => event.metadata?.runId === runId)).toBe(true);
```

When testing retention, create an expired report using a deterministic `generatedAt` and `retentionDays`, call the administrator-only pruning procedure, and verify all three outcomes: the deleted count, the hidden original report entry, and the visible deletion tombstone in dashboard audit history.

Database-backed tests can take longer than pure unit tests under concurrent MySQL load. Use an explicit Vitest timeout for those cases rather than weakening the assertion.

## 5. Adding a new service test case

When adding a new backend feature, use the following sequence.

### Step 1: Identify the contract boundary

Decide whether the test belongs at the domain helper level, tRPC procedure level, HTTP transport level, database persistence level, or a combination. A direct helper test is not a substitute for a protected procedure test when authorization is part of the requirement.

### Step 2: Add the smallest deterministic test

Give the test a descriptive behavior-oriented name, arrange the input explicitly, invoke one primary operation, and assert the externally meaningful result. Avoid broad snapshots that pass while important fields disappear.

### Step 3: Add negative and security cases

For security controls, add unauthorized, malformed, disallowed, and mismatch cases. For reconciliation, deliberately alter one quantity or owner and assert `MISMATCH`; do not assert only aligned cases.

### Step 4: Run the focused test, then the full suite

```bash
pnpm vitest run server/dashboard.test.ts -t "retention"
pnpm check
pnpm test
```

### Step 5: Update documentation or schemas if the contract changed

If a field is persisted, update the Drizzle schema and migration workflow. If a procedure is exposed, update the control-plane documentation. If a report field is added, update the UI and report ingestion tests together.

## 6. Hardhat and Solidity contract integration tests

Live contract tests use a controlled local Hardhat network. The default RPC endpoint is `http://127.0.0.1:8545` and the expected chain ID is `31337`.

### 6.1 Start the local chain

In one terminal:

```bash
pnpm evm:node
```

The node must bind to the local loopback interface. B-SAFE rejects non-local RPC endpoints unless the controlled environment explicitly opts in through `BSAFE_ALLOW_NONLOCAL_RPC=true`. Do not place production RPC URLs or private keys in tests.

### 6.2 Run the existing live integration suite

In a second terminal:

```bash
pnpm test:evm:ci
```

To run one file while developing:

```bash
BSAFE_EVM_INTEGRATION=true pnpm vitest run automation/tests/erc1155-proxy.integration.test.ts
```

The integration files are guarded with `describe.skipIf(process.env.BSAFE_EVM_INTEGRATION !== "true")`. This prevents normal unit runs from requiring a live chain, but CI uses the no-skip runner to make sure all five scenarios execute.

### 6.3 Standard structure of an integration test

A blockchain integration test should follow this order:

> **Arrange → Execute → Observe → Reconcile → Verify**

Arrange the client, accounts, fixture, and initial state. Execute the transaction through the adapter. Observe the receipt and decoded logs. Reconcile the observed movement with an independently built expected ledger. Verify the resulting contract state with read-only calls.

### 6.4 ERC-1155 batch transfer example

Add the following style of test inside `automation/tests/erc1155-proxy.integration.test.ts`:

```ts
it("reconciles an ERC-1155 batch transfer against recipient balances", async () => {
  const client = new ViemEvmClient(localRpcConfigFromEnv());
  const accounts = await client.publicClient.request({ method: "eth_accounts" });
  const sender = accounts[0] as string;
  const recipient = accounts[1] as string;
  const fixture = await deployFixture(client, sender, "TestERC1155", [
    "ipfs://bsafe/{id}.json",
  ]);

  const mint = await client.submit({
    from: sender,
    to: fixture.address,
    data: encodeCall("TestERC1155", "mintBatch", [
      sender,
      [10n, 11n],
      [8n, 12n],
    ]),
  });
  await client.publicClient.waitForTransactionReceipt({ hash: mint });

  const transfer = await client.submit({
    from: sender,
    to: fixture.address,
    data: encodeCall("TestERC1155", "safeBatchTransferFrom", [
      sender,
      recipient,
      [10n, 11n],
      [3n, 5n],
      "0x",
    ]),
  });
  const receipt = await client.publicClient.waitForTransactionReceipt({
    hash: transfer,
  });

  const event = decodeFixtureLogs(receipt.logs, "TestERC1155").find(
    candidate => candidate?.eventName === "TransferBatch",
  ) as {
    args?: {
      from?: string;
      to?: string;
      ids?: bigint[];
      values?: bigint[];
    };
  } | undefined;

  expect(event?.args?.to?.toLowerCase()).toBe(recipient.toLowerCase());

  const expectedLedger = (event?.args?.ids ?? []).map((assetId, index) => ({
    assetId: assetId.toString(),
    from: event?.args?.from ?? sender,
    to: event?.args?.to ?? recipient,
    quantity: (event?.args?.values?.[index] ?? 0n).toString(),
  }));

  const observedLedger = [
    { assetId: "10", from: sender, to: recipient, quantity: "3" },
    { assetId: "11", from: sender, to: recipient, quantity: "5" },
  ];

  expect(compareLedgerMovements(expectedLedger, observedLedger)).toMatchObject({
    aligned: true,
  });

  expect(await client.publicClient.readContract({
    address: fixture.address as `0x${string}`,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: [10n, recipient as `0x${string}`],
  })).toBe(3n);

  expect(await client.publicClient.readContract({
    address: fixture.address as `0x${string}`,
    abi: ERC1155_ABI,
    functionName: "balanceOf",
    args: [11n, recipient as `0x${string}`],
  })).toBe(5n);
});
```

The event is used to decode what happened, but the final balances are read independently from the contract. If the event and state disagree, the test must fail.

### 6.5 Proxy upgrade test structure

For proxy scenarios, deploy the V1 implementation, deploy the proxy with initialization data, verify state, deploy V2, exercise the blocked governance path, verify the finding, allowlist V2, perform the upgrade, decode the `Upgraded` event, and verify both the implementation version and preserved storage value.

Use `enforceProxyUpgrade` for the policy decision and `recordProxyUpgradeFinding` for evidence persistence. Do not bypass the governance helper by calling `upgradeTo` directly when the test is intended to validate authorization or allowlisting.

### 6.6 Adding a new Solidity fixture

When adding a fixture:

1. Place the Solidity source under `automation/fixtures/`.
2. Keep the fixture deterministic and local-only.
3. Expose explicit events for lifecycle actions.
4. Use dedicated storage slots for proxy implementation/admin state where applicable.
5. Add or update the ABI mapping used by `deployFixture`, `encodeCall`, and `decodeFixtureLogs`.
6. Add a deployment test before adding a multi-step lifecycle test.
7. Add a reconciliation assertion and at least one deliberate mismatch assertion.
8. Run `pnpm test:evm:ci` so the no-skip count remains exactly five, or update the runner’s expected count intentionally if the suite count changes.

## 7. Mocking Hardhat providers for unit tests

Do not start Hardhat for tests that only validate adapter mapping or orchestration logic. Instantiate `ViemEvmClient` with a local-looking URL and spy on its public client methods.

```ts
const client = new ViemEvmClient({
  rpcUrl: "http://127.0.0.1:8545",
  chainId: 31337,
});

vi.spyOn(client.publicClient, "getChainId").mockResolvedValue(31337);
vi.spyOn(client.publicClient, "getBlockNumber").mockResolvedValue(42n);

await expect(client.healthCheck()).resolves.toEqual({
  healthy: true,
  chainId: 31337,
  blockNumber: 42,
});
```

Mock the adapter interface directly when testing orchestration, reconciliation, or reporting. Use the `ViemEvmClient` spy pattern when testing RPC request formatting, chain safety, transaction conversion, or receipt conversion.

## 8. UI and browser tests

Browser tests live under `browser-tests/` and use Playwright. They should test user-visible behavior rather than implementation details.

### 8.1 Running browser tests

```bash
pnpm dev
pnpm test:browser
```

To run one file or test title:

```bash
pnpm exec playwright test browser-tests/report-history.spec.ts
pnpm test:browser --grep "B-SAFE portal branding"
```

### 8.2 Adding a UI interaction test

A good browser test opens the page, uses accessible locators, performs a user action, and asserts visible state.

```ts
import { expect, test } from "@playwright/test";

test("filters report history by format", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /view history/i }).click();
  await expect(page.getByRole("dialog", { name: /nightly report history/i })).toBeVisible();

  await page.getByLabel("FORMAT").selectOption("SARIF");
  await expect(page.getByText(/SARIF/).first()).toBeVisible();
});
```

Prefer `getByRole`, `getByLabel`, and accessible names over CSS selectors. A selector such as `.report-history-detail-row` is appropriate only for geometry or implementation-independent layout assertions where no accessible locator exists.

### 8.3 Accessibility and responsive testing

For dialogs, assert `role="dialog"`, `aria-modal="true"`, a labelled heading, a labelled close control, and keyboard closure where supported. For responsive layouts, call `page.setViewportSize` before navigation and assert dimensions or visibility at the relevant breakpoint.

Do not rely on a screenshot alone. Use screenshots for visual review and browser assertions for measurable facts such as visibility, bounding-box size, object containment, and control state.

## 9. Report generation and ingestion tests

B-SAFE generates HTML, JSON, JUnit, and SARIF evidence. Report serializer tests belong in `automation/tests/pipeline.test.ts`. Ingestion and dashboard persistence tests belong in `server/dashboard.test.ts` or a focused report-ingestion test.

A SARIF finding with CI annotation metadata should include an artifact URI and source region:

```ts
expect(result.locations?.[0]).toMatchObject({
  physicalLocation: {
    artifactLocation: {
      uri: "automation/fixtures/UpgradeableProxy.sol",
    },
    region: {
      startLine: 1,
      startColumn: 1,
    },
  },
});
```

When changing finding fields, update the model, serializer, parser, persistence mapping, and tests together. A finding that appears in JSON but loses its source location during SARIF serialization is incomplete.

## 10. GitHub Actions and CI validation

The Hardhat workflow is under `.github/workflows/hardhat.yml`. It starts the controlled local network, runs the no-skip live integration command, generates evidence, uploads retained artifacts, and publishes SARIF through `github/codeql-action/upload-sarif`.

The minimal annotation contract is covered by `.github/workflows/fixtures/sarif-annotation.yml` and `server/ciAnnotations.test.ts`. When changing the workflow, verify the following:

| Contract | Required check |
|---|---|
| Permissions | `security-events: write` is present |
| Upload action | `github/codeql-action/upload-sarif@v3` is present |
| SARIF path | Matches the generated report path, currently `reports/bsafe.sarif` in the fixture |
| Category | The workflow uses a stable category such as `bsafe-hardhat` |
| Live scenarios | The runner reports exactly five passed and zero skipped |
| Evidence retention | SARIF/JUnit/JSON/HTML artifacts are uploaded according to the workflow policy |

Before changing the expected live test count in `automation/scripts/run-live-integration.mjs`, add or remove scenarios deliberately and update the documentation and CI assertions in the same change.

## 11. Test naming and review standards

Test names should describe behavior and security intent, not implementation details. Prefer `rejects an unauthorized proxy upgrade and persists a critical finding` over `calls enforceProxyUpgrade`.

Every new security control should normally include a positive case, a negative case, and an independent verification case. Every new contract lifecycle should include receipt/event decoding, resulting state reads, and a mismatch or revert assertion. Every new protected service procedure should include authenticated success and unauthenticated or unauthorized denial.

Keep test data synthetic. Never use production wallets, production RPC endpoints, customer identifiers, real private keys, or customer report artifacts. Avoid fake customer reviews or testimonials in any UI or fixture data; B-SAFE evidence should represent technical test output only.

## 12. Troubleshooting

### The live EVM tests are skipped

The tests require `BSAFE_EVM_INTEGRATION=true`. Use `pnpm test:evm:ci`, which sets the variable automatically and fails if scenarios are skipped. If running manually, start Hardhat first and set the variable explicitly.

```bash
pnpm evm:node
BSAFE_EVM_INTEGRATION=true pnpm vitest run automation/tests/evm.integration.test.ts
```

### The chain ID is rejected

Confirm that the local node is running on `127.0.0.1:8545` and reports chain ID `31337`. Check `BSAFE_EVM_RPC_URL` and `BSAFE_EVM_CHAIN_ID`. Do not set `BSAFE_ALLOW_NONLOCAL_RPC=true` merely to make a test pass; use it only for an explicitly controlled non-loopback environment.

### Database-backed tests time out

Run the focused test to isolate the issue, inspect the dev/database logs, and use a deliberate longer Vitest timeout for the specific database test. Do not remove persistence assertions or convert a database test into an in-memory-only test to avoid load-related timing.

### Browser navigation times out

The dev server keeps HMR and WebSocket connections open. Use `waitUntil: "domcontentloaded"` in Playwright tests rather than waiting for network idle. Confirm that the configured base URL is reachable and that the dev server is running.

### Report artifacts cannot be downloaded

Check that the report has a persisted `artifactKey`, that it begins with the approved `bsafe-reports/` prefix, and that the signed route is being used. The server must be able to reach the configured storage service. Do not expose arbitrary filesystem paths through report download endpoints.

### SARIF annotations do not appear

Validate the SARIF file with the serializer test, confirm that each blocked proxy finding contains a physical artifact URI and source region, and confirm that the workflow has `security-events: write` permission and uploads the same SARIF path generated by the job.

## 13. Recommended pull-request checklist

Before requesting review, run `pnpm check`, `pnpm test`, `pnpm test:coverage`, and `pnpm test:browser`. Pull-request CI runs these gates automatically, then runs `pnpm test:evm:ci` against the controlled Hardhat network. If the change affects EVM behavior, run `pnpm test:evm:ci` locally as well. If it affects report generation or ingestion, run the report generation/ingestion commands and inspect the resulting SARIF/JUnit metadata. If it changes database schema, generate and review the migration before applying it through the project’s database workflow.

Review the diff for accidental secrets, production endpoints, generated artifacts, local-only files, or unintentional changes to the no-skip integration count. Update `todo.md` before implementation for new feature work and mark the item complete only after tests pass. Read `todo.md` before creating a checkpoint.

## 14. Quick reference: where to add a test

| You are adding… | Start here |
|---|---|
| A pipeline rule or serializer behavior | `automation/tests/pipeline.test.ts` |
| ERC-20 or ERC-721 lifecycle behavior | `automation/tests/token-lifecycle.integration.test.ts` |
| ERC-1155 batch or proxy behavior | `automation/tests/erc1155-proxy.integration.test.ts` |
| Chain, block, transaction, or receipt behavior | `automation/tests/evm.integration.test.ts` |
| A protected tRPC/control-plane procedure | `server/dashboard.test.ts` |
| HTTP authentication or serialized tRPC errors | `server/proxyGovernance.http.test.ts` |
| Report storage or signed URLs | `server/storage.test.ts` |
| SARIF workflow annotation behavior | `server/ciAnnotations.test.ts` and `.github/workflows/fixtures/` |
| Dashboard filters, downloads, dialogs, or responsive behavior | `browser-tests/` |
| A new Solidity fixture | `automation/fixtures/`, followed by the matching integration test |

The safest default is to add a focused test at the narrowest boundary first, then add the service, integration, UI, or CI test needed to prove the feature works end to end.
