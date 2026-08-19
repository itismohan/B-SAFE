import { describe, expect, it } from "vitest";
import { ControlledWalletProvider, ViemEvmClient, localRpcConfigFromEnv } from "../src";

describe.skipIf(process.env.BSAFE_EVM_INTEGRATION !== "true")("controlled local EVM network", () => {
  it("observes the local chain and confirms a realistic transaction", async () => {
    const client = new ViemEvmClient(localRpcConfigFromEnv());
    const health = await client.healthCheck();
    expect(health.healthy).toBe(true);
    expect(await client.getChainId()).toBe(31337);
    expect(await client.getBlockNumber()).toBeGreaterThanOrEqual(0);
    const latestBlock = await client.getBlock(health.blockNumber);
    expect(latestBlock.number).toBe(health.blockNumber);

    const accounts = await client.publicClient.request({ method: "eth_accounts" });
    const sender = accounts[0] as string;
    expect(sender).toMatch(/^0x[a-fA-F0-9]{40}$/);
    const balance = await client.publicClient.getBalance({ address: sender as `0x${string}` });
    expect(balance).toBeGreaterThan(0n);

    const provider = new ControlledWalletProvider(localRpcConfigFromEnv().rpcUrl);
    const ephemeral = await provider.createEphemeralWallet();
    await client.submit({ from: sender, to: ephemeral.address, value: "1000000000000000" });
    const signed = await provider.signMessage(ephemeral.address, "B-SAFE local integration");
    expect(await provider.verifySignature("B-SAFE local integration", signed.signature, ephemeral.address)).toBe(true);

    const hash = await provider.sendTransaction(ephemeral.address, sender, "1");
    await client.publicClient.waitForTransactionReceipt({ hash });
    await ephemeral.destroy();

    const unlockedHash = await client.submit({ from: sender, to: sender, value: "1" });
    const receipt = await client.getReceipt(hash);
    expect(receipt?.status).toBe("CONFIRMED");
    expect(receipt?.hash).toBe(hash);

    const transaction = await client.getTransaction(hash);
    expect(transaction?.hash).toBe(hash);
    expect(transaction?.sender.toLowerCase()).toBe(ephemeral.address.toLowerCase());
    expect(transaction?.chainId).toBe(31337);

    const unlockedReceipt = await client.getReceipt(unlockedHash);
    expect(unlockedReceipt?.status).toBe("CONFIRMED");
    expect(transaction?.chainId).toBe(31337);
  });
});
