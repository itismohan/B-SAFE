import { createPublicClient, createWalletClient, http, publicActions, verifyMessage } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { foundry } from "viem/chains";
import type { BlockchainAdapter, TransactionAdapter, WalletAdapter } from "./interfaces";
import type { TransactionObservation } from "../models";

export interface LocalEvmConfig {
  rpcUrl: string;
  chainId?: number;
  allowNonLocal?: boolean;
}

const isLocalRpc = (rpcUrl: string) => {
  try {
    const host = new URL(rpcUrl).hostname;
    return ["127.0.0.1", "localhost", "::1"].includes(host);
  } catch {
    return false;
  }
};

export const assertSafeLocalNetwork = (config: LocalEvmConfig) => {
  if (!config.allowNonLocal && !isLocalRpc(config.rpcUrl)) {
    throw new Error("Refusing non-local RPC endpoint. Set allowNonLocal explicitly for a controlled environment.");
  }
};

export class ViemEvmClient implements BlockchainAdapter, TransactionAdapter {
  readonly name = "EVM / viem";
  readonly publicClient;
  private readonly chain;

  constructor(private readonly config: LocalEvmConfig) {
    assertSafeLocalNetwork(config);
    this.chain = { ...foundry, id: config.chainId ?? 31337, rpcUrls: { default: { http: [config.rpcUrl] }, public: { http: [config.rpcUrl] } } };
    this.publicClient = createPublicClient({ chain: this.chain, transport: http(config.rpcUrl) });
  }

  async getChainId() { return this.publicClient.getChainId(); }
  async getBlockNumber() { return Number(await this.publicClient.getBlockNumber()); }
  async getBlock(number: number) { const block = await this.publicClient.getBlock({ blockNumber: BigInt(number) }); return { number: Number(block.number), hash: block.hash, timestamp: Number(block.timestamp) }; }
  async healthCheck(expectedChainId = this.config.chainId ?? 31337) { const chainId = await this.getChainId(); if (chainId !== expectedChainId) throw new Error(`Unexpected chain ID ${chainId}; expected controlled chain ${expectedChainId}`); return { healthy: true, chainId, blockNumber: await this.getBlockNumber() }; }
  async getTransaction(hash: string): Promise<TransactionObservation | null> {
    try {
      const tx = await this.publicClient.getTransaction({ hash: hash as `0x${string}` });
      return { sender: tx.from, recipient: tx.to ?? "", nonce: tx.nonce, value: tx.value.toString(), gasUsed: tx.gas?.toString(), gasPrice: tx.gasPrice?.toString(), chainId: tx.chainId ?? this.config.chainId ?? 31337, hash: tx.hash, signatureValid: true, blockNumber: tx.blockNumber ? Number(tx.blockNumber) : undefined, blockHash: tx.blockHash ?? undefined, status: tx.blockHash ? "CONFIRMED" : "PENDING", events: [] };
    } catch { return null; }
  }
  async getReceipt(hash: string) {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash: hash as `0x${string}` });
      return { hash: receipt.transactionHash, blockNumber: Number(receipt.blockNumber), status: receipt.status === "success" ? "CONFIRMED" as const : "REVERTED" as const, events: [] };
    } catch { return null; }
  }
  async submit(input: { from: string; to: string; data?: string; value?: string }) {
    assertSafeLocalNetwork(this.config);
    const request = this.publicClient.request as unknown as (args: { method: string; params: unknown[] }) => Promise<unknown>;
    return request({ method: "eth_sendTransaction", params: [{ from: input.from, to: input.to, data: input.data ?? "0x", value: input.value ? `0x${BigInt(input.value).toString(16)}` : "0x0" }] }) as Promise<`0x${string}`>;
  }
  async observe(hash: string) { const tx = await this.getTransaction(hash); if (!tx) throw new Error(`Transaction not found: ${hash}`); return tx; }
}

export class ControlledWalletProvider implements WalletAdapter {
  private readonly signers = new Map<string, { account: ReturnType<typeof privateKeyToAccount>; client: ReturnType<typeof createWalletClient> }>();
  constructor(private readonly rpcUrl: string, private readonly chainId = 31337) { assertSafeLocalNetwork({ rpcUrl, chainId }); }
  async createEphemeralWallet() {
    const privateKey = generatePrivateKey();
    const account = privateKeyToAccount(privateKey);
    const chain = { ...foundry, id: this.chainId, rpcUrls: { default: { http: [this.rpcUrl] }, public: { http: [this.rpcUrl] } } };
    const client = createWalletClient({ account, chain, transport: http(this.rpcUrl) }).extend(publicActions);
    this.signers.set(account.address.toLowerCase(), { account, client });
    return { address: account.address, destroy: async () => { this.signers.delete(account.address.toLowerCase()); } };
  }
  async signMessage(address: string, message: string) { const signer = this.signers.get(address.toLowerCase()); if (!signer) throw new Error(`Unknown or destroyed ephemeral wallet: ${address}`); return { address: signer.account.address, signature: await signer.client.signMessage({ account: signer.account, message }) }; }
  async verifySignature(message: string, signature: string, address: string) { return verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` }); }
  async sendTransaction(address: string, to: string, value = "0") { const signer = this.signers.get(address.toLowerCase()); if (!signer) throw new Error(`Unknown or destroyed ephemeral wallet: ${address}`); return signer.client.sendTransaction({ account: signer.account, chain: null, to: to as `0x${string}`, value: BigInt(value) }); }
}

export const localRpcConfigFromEnv = (): LocalEvmConfig => ({ rpcUrl: process.env.BSAFE_EVM_RPC_URL ?? "http://127.0.0.1:8545", chainId: Number(process.env.BSAFE_EVM_CHAIN_ID ?? "31337"), allowNonLocal: process.env.BSAFE_ALLOW_NONLOCAL_RPC === "true" });
