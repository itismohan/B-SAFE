import type { EvidenceRecord, ReconciliationResult, TransactionObservation } from "../models";

export interface BlockchainAdapter {
  readonly name: string;
  getChainId(): Promise<number>;
  getBlockNumber(): Promise<number>;
  getTransaction(hash: string): Promise<TransactionObservation | null>;
  getReceipt(hash: string): Promise<{ hash: string; blockNumber: number; status: "CONFIRMED" | "REVERTED"; events: readonly string[] } | null>;
}

export interface WalletAdapter {
  createEphemeralWallet(): Promise<{ address: string; destroy(): Promise<void> }>;
  signMessage(address: string, message: string): Promise<{ signature: string; address: string }>;
  verifySignature(message: string, signature: string, address: string): Promise<boolean>;
}

export interface SmartContractAdapter {
  read(address: string, method: string, args: readonly unknown[]): Promise<unknown>;
  write(address: string, method: string, args: readonly unknown[], signer: string): Promise<string>;
  inspect(address: string): Promise<{ verified: boolean; bytecodeHash: string; proxy: boolean }>;
}

export interface TransactionAdapter {
  submit(input: { from: string; to: string; data?: string; value?: string }): Promise<string>;
  observe(hash: string): Promise<TransactionObservation>;
}

export interface EventAdapter {
  getEvents(filter: { address?: string; fromBlock?: number; toBlock?: number }): Promise<readonly Record<string, unknown>[]>;
}

export interface BlockAdapter {
  getBlock(number: number): Promise<{ number: number; hash: string; timestamp: number } | null>;
}

export interface LedgerAdapter {
  getBalance(assetId: string, owner: string): Promise<string>;
  getEntry(assetId: string, transactionHash: string): Promise<Record<string, unknown> | null>;
}

export interface AssetAdapter {
  getState(assetId: string): Promise<{ stage: string; owner: string; quantity: string; valuation?: string }>;
  transition(assetId: string, stage: string, actor: string): Promise<string>;
}

export interface OracleAdapter {
  getValue(assetId: string): Promise<{ value: string; source: string; observedAt: string }>;
}

export interface SecurityScanner {
  scanContract(address: string): Promise<readonly EvidenceRecord[]>;
  scanDependencies(): Promise<readonly EvidenceRecord[]>;
}

export interface ReconciliationAdapter {
  reconcile(transactionHash: string): Promise<ReconciliationResult>;
}
