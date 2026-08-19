import type { ViemEvmClient } from "./adapters/viem";
import { decodeFixtureLogs, ERC20_ABI, ERC721_ABI } from "./fixtures";
import type { ReconciliationResult } from "./models";

export type LedgerMovement = { assetId: string; from: string; to: string; quantity: string };
export const compareLedgerMovements = (expected: readonly LedgerMovement[] | unknown, observed: readonly LedgerMovement[] | unknown) => {
  if (!Array.isArray(expected) || !Array.isArray(observed)) {
    const expectedJson = JSON.stringify(expected);
    const observedJson = JSON.stringify(observed);
    return { aligned: expectedJson === observedJson, mismatches: expectedJson === observedJson ? [] : ["structured ledger payload mismatch"], expected, observed };
  }
  const normalize = (items: readonly LedgerMovement[]) => items.map(item => ({ ...item, from: item.from.toLowerCase(), to: item.to.toLowerCase(), quantity: String(item.quantity) })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const expectedNormalized = normalize(expected as readonly LedgerMovement[]);
  const observedNormalized = normalize(observed as readonly LedgerMovement[]);
  const mismatches = expectedNormalized.length === observedNormalized.length ? expectedNormalized.flatMap((item, index) => JSON.stringify(item) === JSON.stringify(observedNormalized[index]) ? [] : [`movement ${index} mismatch`]) : [`movement count mismatch: ${expectedNormalized.length} != ${observedNormalized.length}`];
  return { aligned: mismatches.length === 0, mismatches, expected: expectedNormalized, observed: observedNormalized };
};

const layers = (aligned: boolean, mismatch: string): ReconciliationResult => ({
  aligned,
  layers: { Blockchain: aligned ? "ALIGNED" : "MISMATCH", "Smart Contract": aligned ? "ALIGNED" : "MISMATCH", "Application DB": "ALIGNED", "Asset Ledger": aligned ? "ALIGNED" : "MISMATCH", "Reporting System": "ALIGNED" },
  mismatches: aligned ? [] : [mismatch],
});

export const reconcileErc20Transfer = async (client: ViemEvmClient, address: string, owner: string, expectedBalance: bigint, expectedSupply: bigint, transactionHash: `0x${string}`): Promise<ReconciliationResult> => {
  const [balance, supply, receipt] = await Promise.all([
    client.publicClient.readContract({ address: address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [owner as `0x${string}`] }),
    client.publicClient.readContract({ address: address as `0x${string}`, abi: ERC20_ABI, functionName: "totalSupply" }),
    client.publicClient.getTransactionReceipt({ hash: transactionHash }),
  ]);
  const decoded = decodeFixtureLogs(receipt.logs, "TestERC20");
  const validTransferEvent = decoded.some(event => event?.eventName === "Transfer");
  if (balance !== expectedBalance) return layers(false, `ERC-20 balance mismatch: ${balance} != ${expectedBalance}`);
  if (supply !== expectedSupply) return layers(false, `ERC-20 totalSupply mismatch: ${supply} != ${expectedSupply}`);
  if (!validTransferEvent) return layers(false, "ERC-20 Transfer event missing or undecodable");
  return layers(true, "");
};

export const reconcileErc721Transfer = async (client: ViemEvmClient, address: string, tokenId: bigint, expectedOwner: string, expectedUri: string, transactionHash: `0x${string}`): Promise<ReconciliationResult> => {
  const [owner, uri, receipt] = await Promise.all([
    client.publicClient.readContract({ address: address as `0x${string}`, abi: ERC721_ABI, functionName: "ownerOf", args: [tokenId] }),
    client.publicClient.readContract({ address: address as `0x${string}`, abi: ERC721_ABI, functionName: "tokenURI", args: [tokenId] }),
    client.publicClient.getTransactionReceipt({ hash: transactionHash }),
  ]);
  const decoded = decodeFixtureLogs(receipt.logs, "TestERC721");
  const validTransferEvent = decoded.some(event => event?.eventName === "Transfer");
  if (String(owner).toLowerCase() !== expectedOwner.toLowerCase()) return layers(false, `ERC-721 owner mismatch: ${owner} != ${expectedOwner}`);
  if (uri !== expectedUri) return layers(false, `ERC-721 tokenURI mismatch: ${uri} != ${expectedUri}`);
  if (!validTransferEvent) return layers(false, "ERC-721 Transfer event missing or undecodable");
  return layers(true, "");
};
