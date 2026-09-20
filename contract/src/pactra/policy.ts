/**
 * Pactra — Agent Policy & Capability Specification
 *
 * Defines the TaskPolicy and AgentCapability model.
 * The TaskPolicy defines the strict security boundary for an autonomous AI agent.
 * The agent may NEVER exceed these policy limits or obtain generic wallet custody.
 */

import { createHash } from "node:crypto";

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
] as const;

export interface TaskPolicy {
  readonly taskId: string;
  readonly maxTotalBudget: bigint;
  readonly maxSpendPerTransaction: bigint;
  readonly approvedCategories: readonly AgentCapability[];
  readonly approvedProviders: readonly string[];
  readonly allowedCapabilities: readonly AgentCapability[];
  readonly expirationTimestamp: number;
  readonly completionConditionCommitment: string;
  readonly salt: string;
}

export interface CreateTaskPolicyParams {
  taskId: string;
  maxTotalBudget: bigint | number;
  maxSpendPerTransaction: bigint | number;
  approvedCategories: AgentCapability[];
  approvedProviders: string[];
  allowedCapabilities: AgentCapability[];
  expirationTimestamp?: number;
  completionConditionCommitment: string;
  salt?: string;
}

export class PolicyViolationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(`[Pactra Policy Violation] ${code}: ${message}`);
    this.name = "PolicyViolationError";
  }
}

/**
 * Validates and instantiates a cryptographic TaskPolicy.
 */
export function createTaskPolicy(params: CreateTaskPolicyParams): TaskPolicy {
  const maxTotalBudget = BigInt(params.maxTotalBudget);
  const maxSpendPerTransaction = BigInt(params.maxSpendPerTransaction);

  if (maxTotalBudget <= 0n) {
    throw new PolicyViolationError("INVALID_TOTAL_BUDGET", "Max total budget must be greater than zero.");
  }

  if (maxSpendPerTransaction <= 0n) {
    throw new PolicyViolationError("INVALID_TX_BUDGET", "Max spend per transaction must be greater than zero.");
  }

  if (maxSpendPerTransaction > maxTotalBudget) {
    throw new PolicyViolationError(
      "PER_TX_EXCEEDS_TOTAL",
      `Max spend per transaction (${maxSpendPerTransaction}) cannot exceed total budget (${maxTotalBudget}).`
    );
  }

  if (!params.allowedCapabilities || params.allowedCapabilities.length === 0) {
    throw new PolicyViolationError("EMPTY_CAPABILITIES", "Task policy must specify at least one allowed capability.");
  }

  const expirationTimestamp = params.expirationTimestamp ?? Date.now() + 86400 * 1000;
  if (expirationTimestamp <= Date.now()) {
    throw new PolicyViolationError("EXPIRED_POLICY", "Expiration timestamp must be in the future.");
  }

  const salt = params.salt ?? createHash("sha256").update(`${params.taskId}:${Date.now()}`).digest("hex");

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

  return "0x" + createHash("sha256").update(payload).digest("hex");
}
