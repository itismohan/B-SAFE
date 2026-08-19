import { describe, expect, it } from "vitest";
import { ViemEvmClient, decodeFixtureLogs, deployFixture, encodeCall, localRpcConfigFromEnv, reconcileErc20Transfer, reconcileErc721Transfer } from "../src";

describe.skipIf(process.env.BSAFE_EVM_INTEGRATION !== "true")("controlled token lifecycle fixtures", () => {
  it("deploys and reconciles an ERC-20 mint and transfer lifecycle", async () => {
    const client = new ViemEvmClient(localRpcConfigFromEnv());
    const accounts = await client.publicClient.request({ method: "eth_accounts" });
    const sender = accounts[0] as string;
    const recipient = accounts[1] as string;
    const fixture = await deployFixture(client, sender, "TestERC20");

    const mint = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC20", "mint", [sender, 1000n]) });
    await client.publicClient.waitForTransactionReceipt({ hash: mint });
    const approval = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC20", "approve", [recipient, 500n]) });
    const approvalReceipt = await client.publicClient.waitForTransactionReceipt({ hash: approval });
    expect(decodeFixtureLogs(approvalReceipt.logs, "TestERC20").some(event => event?.eventName === "Approval")).toBe(true);

    const transfer = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC20", "transfer", [recipient, 250n]) });
    const transferReceipt = await client.publicClient.waitForTransactionReceipt({ hash: transfer });
    expect(decodeFixtureLogs(transferReceipt.logs, "TestERC20").some(event => event?.eventName === "Transfer")).toBe(true);
    expect((await reconcileErc20Transfer(client, fixture.address, sender, 750n, 1000n, transfer)).aligned).toBe(true);
    const mismatch = await reconcileErc20Transfer(client, fixture.address, sender, 999n, 1000n, transfer);
    expect(mismatch.aligned).toBe(false);
    expect(mismatch.mismatches[0]).toContain("balance mismatch");
  });

  it("deploys and reconciles an ERC-721 mint, approval, and ownership transfer", async () => {
    const client = new ViemEvmClient(localRpcConfigFromEnv());
    const accounts = await client.publicClient.request({ method: "eth_accounts" });
    const sender = accounts[0] as string;
    const recipient = accounts[1] as string;
    const fixture = await deployFixture(client, sender, "TestERC721");

    const mint = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC721", "mint", [sender, 7n, "ipfs://bsafe/7"]) });
    await client.publicClient.waitForTransactionReceipt({ hash: mint });
    const approval = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC721", "approve", [recipient, 7n]) });
    await client.publicClient.waitForTransactionReceipt({ hash: approval });
    const transfer = await client.submit({ from: sender, to: fixture.address, data: encodeCall("TestERC721", "transferFrom", [sender, recipient, 7n]) });
    await client.publicClient.waitForTransactionReceipt({ hash: transfer });
    expect((await reconcileErc721Transfer(client, fixture.address, 7n, recipient, "ipfs://bsafe/7", transfer)).aligned).toBe(true);
    const mismatch = await reconcileErc721Transfer(client, fixture.address, 7n, sender, "ipfs://bsafe/7", transfer);
    expect(mismatch.aligned).toBe(false);
    expect(mismatch.mismatches[0]).toContain("owner mismatch");
  });
});
