import { createHash } from "node:crypto";
import type { BusinessValidityInput, EvidenceRecord, TransactionObservation } from "./models";
import { isBusinessValidTransaction } from "./models";

export const sha256Hex = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
export const isEvmAddress = (address: string) => /^0x[a-fA-F0-9]{40}$/.test(address);
export const verifyDigest = (input: string, expectedHex: string) => sha256Hex(input).toLowerCase() === expectedHex.replace(/^0x/, "").toLowerCase();

export const verifyTransaction = (tx: TransactionObservation, expected: Partial<TransactionObservation>): string[] => {
  const mismatches: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if (value !== undefined && tx[key as keyof TransactionObservation] !== value) mismatches.push(`${key} mismatch`);
  }
  if (tx.status === "REVERTED") mismatches.push("transaction reverted");
  if (!tx.signatureValid) mismatches.push("signature invalid");
  return mismatches;
};

export const verifyBusinessValidity = (input: BusinessValidityInput) => ({
  valid: isBusinessValidTransaction(input),
  failedControls: Object.entries(input).filter(([, value]) => !value).map(([key]) => key),
});

export const redactSecrets = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value
      .replace(/0x[a-fA-F0-9]{64}/g, "[REDACTED_HEX_SECRET]")
      .replace(/(private[_ -]?key|seed|mnemonic|token|password)\s*[:=]\s*[^,\s]+/gi, "$1=[REDACTED]");
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, redactSecrets(child)]));
  return value;
};

export const evidence = (id: string, kind: EvidenceRecord["kind"], payload: Record<string, unknown>): EvidenceRecord => ({
  id,
  kind,
  capturedAt: new Date().toISOString(),
  payload: redactSecrets(payload) as Record<string, unknown>,
  redacted: true,
});
