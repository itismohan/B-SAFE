import { recordProxyUpgradeFinding } from "./reportIngestion";

export type ProxyGovernanceInput = { proxyAddress: string; caller: string; admin: string; implementation: string; allowlisted: boolean };

export async function enforceProxyUpgradePolicy(input: ProxyGovernanceInput) {
  if (input.caller.toLowerCase() !== input.admin.toLowerCase()) {
    const finding = await recordProxyUpgradeFinding({ proxyAddress: input.proxyAddress, implementation: input.implementation, reason: "UNAUTHORIZED_CALLER" });
    return { allowed: false as const, reason: "UNAUTHORIZED_CALLER" as const, finding };
  }
  if (!input.allowlisted) {
    const finding = await recordProxyUpgradeFinding({ proxyAddress: input.proxyAddress, implementation: input.implementation, reason: "IMPLEMENTATION_NOT_ALLOWLISTED" });
    return { allowed: false as const, reason: "IMPLEMENTATION_NOT_ALLOWLISTED" as const, finding };
  }
  return { allowed: true as const, reason: null, finding: null };
}
