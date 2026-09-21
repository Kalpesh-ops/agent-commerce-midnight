/**
 * Pactra — Agent Policy & Capability Specification
 *
 * Defines the TaskPolicy and AgentCapability model.
 * The TaskPolicy defines the strict security boundary for an autonomous AI agent.
 * The agent may NEVER exceed these policy limits or obtain generic wallet custody.
 */

import { sha256Hex } from "./cryptoUtils.js";

export type AgentCapability =
  | "COMPUTE"
  | "STORAGE"
  | "API_CALL"
  | "DEPLOYMENT"
  | "DATA_PROCESSING";

export const ALL_CAPABILITIES: readonly AgentCapability[] = [
  "COMPUTE",
  "STORAGE",
  "API_CALL",
  "DEPLOYMENT",
  "DATA_PROCESSING",
];

export interface TaskPolicy {
  readonly taskId: string;
  readonly maxTotalBudget: bigint;
  readonly maxSpendPerTransaction: bigint;
  readonly approvedCategories: readonly string[];
  readonly approvedProviders: readonly string[];
  readonly allowedCapabilities: readonly AgentCapability[];
  readonly expirationTimestamp: number;
  readonly completionConditionCommitment?: string;
  readonly salt?: string;
}

export class PolicyViolationError extends Error {
  constructor(
    public readonly violationCode: string,
    message: string
  ) {
    super(`[Pactra Policy Violation: ${violationCode}] ${message}`);
    this.name = "PolicyViolationError";
  }
}

/**
 * Validates and instantiates a cryptographic TaskPolicy.
 */
export function createTaskPolicy(params: {
  taskId: string;
  maxTotalBudget: bigint | number;
  maxSpendPerTransaction: bigint | number;
  approvedCategories: string[];
  approvedProviders: string[];
  allowedCapabilities: AgentCapability[];
  expirationTimestamp: number;
  completionConditionCommitment?: string;
  salt?: string;
}): TaskPolicy {
  const maxTotalBudget = BigInt(params.maxTotalBudget);
  const maxSpendPerTransaction = BigInt(params.maxSpendPerTransaction);
  const expirationTimestamp = params.expirationTimestamp;

  if (maxTotalBudget <= 0n) {
    throw new PolicyViolationError("INVALID_TOTAL_BUDGET", "Max total budget must be strictly positive.");
  }

  if (maxSpendPerTransaction <= 0n) {
    throw new PolicyViolationError("INVALID_TX_LIMIT", "Max spend per transaction must be strictly positive.");
  }

  if (maxSpendPerTransaction > maxTotalBudget) {
    throw new PolicyViolationError(
      "PER_TX_EXCEEDS_TOTAL",
      "Max spend per transaction cannot exceed total task budget."
    );
  }

  if (params.approvedCategories.length === 0) {
    throw new PolicyViolationError("NO_APPROVED_CATEGORIES", "Policy must specify at least one approved service category.");
  }

  if (params.approvedProviders.length === 0) {
    throw new PolicyViolationError("NO_APPROVED_PROVIDERS", "Policy must specify at least one approved provider commitment.");
  }

  if (params.allowedCapabilities.length === 0) {
    throw new PolicyViolationError("NO_ALLOWED_CAPABILITIES", "Policy must authorize at least one capability.");
  }

  if (expirationTimestamp <= Date.now()) {
    throw new PolicyViolationError("EXPIRED_POLICY", "Expiration timestamp must be in the future.");
  }

  const salt = params.salt ?? sha256Hex(`${params.taskId}:${Date.now()}`);

  return {
    taskId: params.taskId,
    maxTotalBudget,
    maxSpendPerTransaction,
    approvedCategories: Object.freeze([...params.approvedCategories]),
    approvedProviders: Object.freeze([...params.approvedProviders]),
    allowedCapabilities: Object.freeze([...params.allowedCapabilities]),
    expirationTimestamp,
    completionConditionCommitment: params.completionConditionCommitment ?? "",
    salt,
  };
}

/**
 * Computes a deterministic 32-byte hex commitment for the TaskPolicy.
 * This commitment binds the policy to the Midnight smart contract ledger state.
 */
export function computePolicyCommitment(policy: TaskPolicy): string {
  const payload = JSON.stringify({
    taskId: policy.taskId,
    maxTotalBudget: policy.maxTotalBudget.toString(),
    maxSpendPerTransaction: policy.maxSpendPerTransaction.toString(),
    approvedCategories: [...policy.approvedCategories].sort(),
    approvedProviders: [...policy.approvedProviders].sort(),
    allowedCapabilities: [...policy.allowedCapabilities].sort(),
    expirationTimestamp: policy.expirationTimestamp,
    completionConditionCommitment: policy.completionConditionCommitment,
    salt: policy.salt,
  });

  return "0x" + sha256Hex(payload);
}

/**
 * Capability bitmask mapping for compact on-chain representation.
 */
export const CAPABILITY_BITS: Record<AgentCapability, number> = {
  COMPUTE: 1 << 0, // 1
  STORAGE: 1 << 1, // 2
  API_CALL: 1 << 2, // 4
  DEPLOYMENT: 1 << 3, // 8
  DATA_PROCESSING: 1 << 4, // 16
};

export function computeCapabilityBitmask(capabilities: readonly AgentCapability[]): number {
  return capabilities.reduce((mask, cap) => mask | (CAPABILITY_BITS[cap] ?? 0), 0);
}

export function isCapabilityAuthorized(bitmask: number, capability: AgentCapability): boolean {
  const bit = CAPABILITY_BITS[capability];
  if (!bit) return false;
  return (bitmask & bit) === bit;
}

/**
 * On-chain Policy Binding represents the immutable constraints anchored to the Midnight ledger.
 */
export interface OnChainPolicyBinding {
  readonly policyCommitment: string;
  readonly taskId: string;
  readonly capabilityBitmask: number;
  readonly providerAllowlistRoot: string;
  readonly maxBudget: bigint;
  readonly maxSpendPerTransaction: bigint;
  readonly expirationTimestamp: number;
  readonly conditionRoot: string;
}

/**
 * Creates an OnChainPolicyBinding from a TaskPolicy.
 */
export function createOnChainPolicyBinding(policy: TaskPolicy): OnChainPolicyBinding {
  const policyCommitment = computePolicyCommitment(policy);
  const capabilityBitmask = computeCapabilityBitmask(policy.allowedCapabilities);

  // Compute a Merkle/composite root for the approved providers
  const sortedProviders = [...policy.approvedProviders].sort();
  const providerAllowlistRoot = "0x" + sha256Hex(JSON.stringify(sortedProviders));

  return {
    policyCommitment,
    taskId: policy.taskId,
    capabilityBitmask,
    providerAllowlistRoot,
    maxBudget: policy.maxTotalBudget,
    maxSpendPerTransaction: policy.maxSpendPerTransaction,
    expirationTimestamp: policy.expirationTimestamp,
    conditionRoot: policy.completionConditionCommitment ?? "",
  };
}

/**
 * Validates that a candidate policy matches an on-chain committed binding.
 */
export function validatePolicyAgainstOnChainBinding(
  candidatePolicy: TaskPolicy,
  binding: OnChainPolicyBinding
): { valid: boolean; reason?: string } {
  const computedCommitment = computePolicyCommitment(candidatePolicy);
  if (computedCommitment.toLowerCase() !== binding.policyCommitment.toLowerCase()) {
    return {
      valid: false,
      reason: `Policy commitment mismatch: got "${computedCommitment}", expected "${binding.policyCommitment}".`,
    };
  }

  if (candidatePolicy.taskId !== binding.taskId) {
    return { valid: false, reason: `Task ID mismatch: "${candidatePolicy.taskId}" vs "${binding.taskId}".` };
  }

  if (candidatePolicy.maxTotalBudget > binding.maxBudget) {
    return { valid: false, reason: `Policy budget (${candidatePolicy.maxTotalBudget}) exceeds on-chain binding (${binding.maxBudget}).` };
  }

  if (candidatePolicy.maxSpendPerTransaction > binding.maxSpendPerTransaction) {
    return {
      valid: false,
      reason: `Policy per-tx limit (${candidatePolicy.maxSpendPerTransaction}) exceeds on-chain binding (${binding.maxSpendPerTransaction}).`,
    };
  }

  if (Date.now() > binding.expirationTimestamp) {
    return { valid: false, reason: `On-chain policy binding has expired.` };
  }

  return { valid: true };
}

export type { TaskPolicyEnvelope } from "./agentClient.js";
