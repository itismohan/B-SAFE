import { describe, expect, it } from "vitest";
import { compareLedgerMovements, decodeFixtureLogs, deployFixture, encodeCall, enforceProxyUpgrade, ERC1155_ABI, localRpcConfigFromEnv, PROXY_ABI, ViemEvmClient } from "../src";
import { recordProxyUpgradeFinding } from "../../server/reportIngestion";

describe.skipIf(process.env.BSAFE_EVM_INTEGRATION !== "true")("ERC-1155 and upgradeable proxy fixtures", () => {
  it("runs ERC-1155 mint, batch mint, transfer, and event lifecycle", async () => {
    const client = new ViemEvmClient(localRpcConfigFromEnv());
    const accounts = await client.publicClient.request({ method: "eth_accounts" });
    const sender = accounts[0] as string;
    const recipient = accounts[1] as string;
    const fixture = await deployFixture(client, sender, "TestERC1155", ["ipfs://bsafe/{id}.json"]);

    const mint = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC1155", "mint", [sender, 1n, 10n]) });
    await client.publicClient.waitForTransactionReceipt({ hash: mint });
    const batch = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC1155", "mintBatch", [sender, [2n, 3n], [5n, 7n]]) });
    const batchReceipt = await client.publicClient.waitForTransactionReceipt({ hash: batch });
    const batchEvent = decodeFixtureLogs(batchReceipt.logs, "TestERC1155").find(event => event?.eventName === "TransferBatch") as { args?: { from?: string; to?: string; ids?: bigint[]; values?: bigint[] } } | undefined;
    const expectedBatch = (batchEvent?.args?.ids ?? []).map((id, index) => ({ assetId: id.toString(), from: batchEvent?.args?.from ?? "0x0000000000000000000000000000000000000000", to: batchEvent?.args?.to ?? sender, quantity: (batchEvent?.args?.values?.[index] ?? 0n).toString() }));
    expect(compareLedgerMovements(expectedBatch, expectedBatch).aligned).toBe(true);
    expect(compareLedgerMovements(expectedBatch, expectedBatch.map(item => ({ ...item, quantity: item.quantity === "5" ? "4" : item.quantity }))).aligned).toBe(false);
    const transfer = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC1155", "safeTransferFrom", [sender, recipient, 1n, 4n, "0x"]) });
    const receipt = await client.publicClient.waitForTransactionReceipt({ hash: transfer });
    expect(decodeFixtureLogs(receipt.logs, "TestERC1155").some(event => event?.eventName === "TransferSingle")).toBe(true);
    expect(await client.publicClient.readContract({ address: fixture.address as `0x${string}`, abi: ERC1155_ABI, functionName: "balanceOf", args: [1n, recipient as `0x${string}`] })).toBe(4n);
    expect(await client.publicClient.readContract({ address: fixture.address as `0x${string}`, abi: ERC1155_ABI, functionName: "balanceOf", args: [2n, sender as `0x${string}`] })).toBe(5n);
  });

  it("preserves proxy state across implementation upgrade", async () => {
    const client = new ViemEvmClient(localRpcConfigFromEnv());
    const accounts = await client.publicClient.request({ method: "eth_accounts" });
    const sender = accounts[0] as string;
    const v1 = await deployFixture(client, sender, "UpgradeableCounterV1");
    const init = encodeCall("UpgradeableCounterV1", "initialize", [sender]);
    const proxy = await deployFixture(client, sender, "SimpleProxy", [v1.address, sender, init]);

    await client.submit({ from: sender, to: proxy.address, data: encodeCall("UpgradeableCounterV1", "increment", []) });
    expect(await client.publicClient.readContract({ address: proxy.address as `0x${string}`, abi: PROXY_ABI, functionName: "value" })).toBe(1n);
    const v2 = await deployFixture(client, sender, "UpgradeableCounterV2");
    await expect(enforceProxyUpgrade({ caller: sender, admin: sender, implementation: v2.address, allowlisted: false }, decision => recordProxyUpgradeFinding({ proxyAddress: proxy.address, implementation: v2.address, reason: decision.reason! }))).rejects.toThrow("IMPLEMENTATION_NOT_ALLOWLISTED");
    expect(await client.publicClient.readContract({ address: proxy.address as `0x${string}`, abi: PROXY_ABI, functionName: "allowedImplementations", args: [v2.address as `0x${string}`] })).toBe(false);
    const allow = await client.submit({ from: sender, to: proxy.address, data: encodeCall("SimpleProxy", "setImplementationAllowed", [v2.address, true]) });
    await client.publicClient.waitForTransactionReceipt({ hash: allow });
    const upgrade = await client.submit({ from: sender, to: proxy.address, data: encodeCall("SimpleProxy", "upgradeTo", [v2.address]) });
    const upgradeReceipt = await client.publicClient.waitForTransactionReceipt({ hash: upgrade });
    expect(decodeFixtureLogs(upgradeReceipt.logs, "SimpleProxy").some(event => event?.eventName === "Upgraded")).toBe(true);
    expect(await client.publicClient.readContract({ address: proxy.address as `0x${string}`, abi: PROXY_ABI, functionName: "version" })).toBe(2n);
    await client.submit({ from: sender, to: proxy.address, data: encodeCall("UpgradeableCounterV2", "decrement", []) });
    expect(await client.publicClient.readContract({ address: proxy.address as `0x${string}`, abi: PROXY_ABI, functionName: "value" })).toBe(0n);
  });
});
