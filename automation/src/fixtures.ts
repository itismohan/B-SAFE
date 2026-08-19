import { decodeEventLog, encodeDeployData, encodeFunctionData, parseAbi, type Abi } from "viem";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ViemEvmClient } from "./adapters/viem";

export const ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

export const ERC1155_ABI = parseAbi([
  "constructor(string initialUri)",
  "function mint(address to, uint256 id, uint256 amount)",
  "function mintBatch(address to, uint256[] ids, uint256[] amounts)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
  "function balanceOf(uint256 id, address owner) view returns (uint256)",
  "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
  "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
]);

export const PROXY_ABI = parseAbi([
  "constructor(address implementation, address initialAdmin, bytes initData)",
  "function implementation() view returns (address)",
  "function upgradeTo(address newImplementation)",
  "function admin() view returns (address)",
  "function allowedImplementations(address) view returns (bool)",
  "function setImplementationAllowed(address implementationAddress, bool allowed)",
  "function value() view returns (uint256)",
  "function increment()",
  "function decrement()",
  "function version() view returns (uint256)",
  "function initialize(address initialAdmin)",
  "event Upgraded(address indexed implementation)",
  "event ImplementationAllowed(address indexed implementation, bool allowed)",
]);

export const ERC721_ABI = parseAbi([
  "function mint(address to, uint256 tokenId, string uri)",
  "function approve(address approved, uint256 tokenId)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
]);

const artifact = (name: "TestERC20" | "TestERC721" | "TestERC1155" | "UpgradeableCounterV1" | "UpgradeableCounterV2" | "SimpleProxy") => {
  const source = name === "UpgradeableCounterV1" || name === "UpgradeableCounterV2" || name === "SimpleProxy" ? "UpgradeableCounter" : name;
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../artifacts/contracts/fixtures/${source}.sol/${name}.json`, import.meta.url)), "utf8")) as { abi: unknown[]; bytecode: `0x${string}` };
};

export const deployFixture = async (client: ViemEvmClient, from: string, name: "TestERC20" | "TestERC721" | "TestERC1155" | "UpgradeableCounterV1" | "UpgradeableCounterV2" | "SimpleProxy", args: readonly unknown[] = []) => {
  const loaded = artifact(name);
  const deploymentData = encodeDeployData({ abi: loaded.abi as Abi, bytecode: loaded.bytecode, args });
  const request = client.publicClient.request as unknown as (args: { method: string; params: unknown[] }) => Promise<unknown>;
  const hash = await request({ method: "eth_sendTransaction", params: [{ from: from as `0x${string}`, data: deploymentData as `0x${string}` }] }) as `0x${string}`;
  const receipt = await client.publicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
  if (!receipt.contractAddress) throw new Error(`${name} deployment did not return a contract address`);
  return { address: receipt.contractAddress, abi: name === "TestERC20" ? ERC20_ABI : name === "TestERC721" ? ERC721_ABI : name === "TestERC1155" ? ERC1155_ABI : PROXY_ABI, deploymentHash: hash as string };
};

export const encodeCall = (name: "TestERC20" | "TestERC721" | "TestERC1155" | "UpgradeableCounterV1" | "UpgradeableCounterV2" | "SimpleProxy", functionName: string, args: readonly unknown[]) => encodeFunctionData({ abi: name === "TestERC20" ? ERC20_ABI : name === "TestERC721" ? ERC721_ABI : name === "TestERC1155" ? ERC1155_ABI : PROXY_ABI, functionName: functionName as never, args: args as never });

export const decodeFixtureLogs = (logs: readonly { address: string; topics: readonly `0x${string}`[]; data: `0x${string}` }[], name: "TestERC20" | "TestERC721" | "TestERC1155" | "SimpleProxy") => logs.map(log => {
  try { return decodeEventLog({ abi: name === "TestERC20" ? ERC20_ABI : name === "TestERC721" ? ERC721_ABI : name === "TestERC1155" ? ERC1155_ABI : PROXY_ABI, data: log.data, topics: log.topics as any }); } catch { return null; }
}).filter(Boolean);
