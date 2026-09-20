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
  readonly completionConditionCommitment: string;
  readonly salt: string;
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
  completionConditionCommitment: string;
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
    completionConditionCommitment: params.completionConditionCommitment,
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
