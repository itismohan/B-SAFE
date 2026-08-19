export type ProxyUpgradeDecision = { allowed: boolean; reason?: "UNAUTHORIZED_CALLER" | "IMPLEMENTATION_NOT_ALLOWLISTED"; finding: { severity: "CRITICAL"; category: "Upgrade authorization"; expected: string; actual: string; locations: { uri: string; startLine: number; startColumn: number }[] } | null };

export function evaluateProxyUpgrade(input: { caller: string; admin: string; implementation: string; allowlisted: boolean }): ProxyUpgradeDecision {
  if (input.caller.toLowerCase() !== input.admin.toLowerCase()) return { allowed: false, reason: "UNAUTHORIZED_CALLER", finding: { severity: "CRITICAL", category: "Upgrade authorization", expected: "Only the proxy admin may upgrade implementations", actual: `Caller ${input.caller} is not the proxy admin`, locations: [{ uri: "automation/fixtures/UpgradeableProxy.sol", startLine: 1, startColumn: 1 }] } };
  if (!input.allowlisted) return { allowed: false, reason: "IMPLEMENTATION_NOT_ALLOWLISTED", finding: { severity: "CRITICAL", category: "Upgrade authorization", expected: "Only allowlisted implementations may be activated", actual: `Implementation ${input.implementation} is not allowlisted`, locations: [{ uri: "automation/fixtures/UpgradeableProxy.sol", startLine: 1, startColumn: 1 }] } };
  return { allowed: true, finding: null };
}

export async function enforceProxyUpgrade(input: { caller: string; admin: string; implementation: string; allowlisted: boolean }, onBlocked: (decision: ProxyUpgradeDecision) => Promise<void> | void) {
  const decision = evaluateProxyUpgrade(input);
  if (!decision.allowed) {
    await onBlocked(decision);
    throw new Error(decision.reason);
  }
  return decision;
}
