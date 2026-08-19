import type { BlockchainAdapter, BlockAdapter, TransactionAdapter } from "./interfaces";
import type { TransactionObservation } from "../models";

export interface EvmClient {
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<number>;
  getTransaction(hash: string): Promise<TransactionObservation | null>;
  getReceipt(hash: string): Promise<{ hash: string; blockNumber: number; status: "CONFIRMED" | "REVERTED"; events: readonly string[] } | null>;
  getBlock(number: number): Promise<{ number: number; hash: string; timestamp: number } | null>;
  sendTransaction(input: { from: string; to: string; data?: string; value?: string }): Promise<string>;
}

export class EvmBlockchainAdapter implements BlockchainAdapter, BlockAdapter, TransactionAdapter {
  readonly name = "EVM";
  constructor(private readonly client: EvmClient) {}

  getChainId() { return this.client.getChainId(); }
  getBlockNumber() { return this.client.getBlockNumber(); }
  getTransaction(hash: string) { return this.client.getTransaction(hash); }
  getReceipt(hash: string) { return this.client.getReceipt(hash); }
  getBlock(number: number) { return this.client.getBlock(number); }
  submit(input: { from: string; to: string; data?: string; value?: string }) { return this.client.sendTransaction(input); }

  async observe(hash: string): Promise<TransactionObservation> {
    const transaction = await this.client.getTransaction(hash);
    if (!transaction) throw new Error(`Transaction not found: ${hash}`);
    return transaction;
  }
}
