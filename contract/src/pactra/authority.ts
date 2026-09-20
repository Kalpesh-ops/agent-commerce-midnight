/**
 * Pactra — Bounded Agent Authority & Budget Isolation
 *
 * Implements the isolated Agent Operating Budget and capability authorization manager.
 * Invariant: The agent NEVER receives direct treasury custody, private keys,
 * or generic `sendTransaction(address, amount)` privileges.
 */

import { AgentCapability, TaskPolicy, PolicyViolationError } from "./policy.js";

export interface AgentOperatingBudget {
  readonly userTreasuryTotal: bigint;
  readonly taskEscrowAllocation: bigint;
  readonly currentSpent: bigint;
  readonly remainingBudget: bigint;
  readonly perTransactionLimit: bigint;
}

export interface ProcurementRequest {
  readonly capability: AgentCapability;
  readonly providerId: string;
  readonly requestedAmount: bigint;
  readonly serviceCategory: AgentCapability;
  readonly objectiveRef: string;
}

export interface AuthorizedProcurementToken {
  readonly authorizationId: string;
  readonly taskId: string;
  readonly capability: AgentCapability;
  readonly providerId: string;
  readonly authorizedAmount: bigint;
  readonly timestamp: number;
}

export class AgentAuthorityManager {
  private currentSpent: bigint = 0n;
  private reservedBudget: bigint = 0n;
  private readonly userTreasuryTotal: bigint;
  private readonly taskEscrowAllocation: bigint;
  private readonly policy: TaskPolicy;

  constructor(params: {
    userTreasuryTotal: bigint | number;
    taskEscrowAllocation: bigint | number;
    policy: TaskPolicy;
  }) {
    this.userTreasuryTotal = BigInt(params.userTreasuryTotal);
    this.taskEscrowAllocation = BigInt(params.taskEscrowAllocation);
    this.policy = params.policy;

    if (this.taskEscrowAllocation > this.userTreasuryTotal) {
      throw new PolicyViolationError(
        "TREASURY_OVERALLOCATION",
        `Task escrow allocation (${this.taskEscrowAllocation}) exceeds total user treasury (${this.userTreasuryTotal}).`
      );
    }

    if (this.taskEscrowAllocation > this.policy.maxTotalBudget) {
      throw new PolicyViolationError(
        "POLICY_BUDGET_EXCEEDED",
        `Task escrow allocation (${this.taskEscrowAllocation}) exceeds policy maximum (${this.policy.maxTotalBudget}).`
      );
    }
  }

  public getBudgetSnapshot(): AgentOperatingBudget {
    return {
      userTreasuryTotal: this.userTreasuryTotal,
      taskEscrowAllocation: this.taskEscrowAllocation,
      currentSpent: this.currentSpent,
      remainingBudget: this.taskEscrowAllocation - this.currentSpent - this.reservedBudget,
      perTransactionLimit: this.policy.maxSpendPerTransaction,
    };
  }

  public getPolicy(): TaskPolicy {
    return this.policy;
  }

  /**
   * Evaluates a procurement request against the task policy.
   * If authorized, reserves the amount and returns an isolated authorization token for the specific service.
   */
  public authorizeProcurement(request: ProcurementRequest): AuthorizedProcurementToken {
    // 1. Enforce Expiration
    if (Date.now() > this.policy.expirationTimestamp) {
      throw new PolicyViolationError(
        "TASK_EXPIRED",
        `Task policy expired at ${new Date(this.policy.expirationTimestamp).toISOString()}.`
      );
    }

    // 2. Enforce Capability Authority
    if (!this.policy.allowedCapabilities.includes(request.capability)) {
      throw new PolicyViolationError(
        "UNAUTHORIZED_CAPABILITY",
        `Agent requested unauthorized capability: "${request.capability}". Allowed: [${this.policy.allowedCapabilities.join(", ")}].`
      );
    }

    // 3. Enforce Approved Service Category
    if (!this.policy.approvedCategories.includes(request.serviceCategory)) {
      throw new PolicyViolationError(
        "UNAPPROVED_CATEGORY",
        `Service category "${request.serviceCategory}" is not approved in task policy.`
      );
    }

    // 4. Enforce Approved Provider Commitment
    if (!this.policy.approvedProviders.includes(request.providerId)) {
      throw new PolicyViolationError(
        "UNAPPROVED_PROVIDER",
        `Provider "${request.providerId}" is not in the approved providers whitelist.`
      );
    }

    // 5. Enforce Per-Transaction Spending Bound
    if (request.requestedAmount > this.policy.maxSpendPerTransaction) {
      throw new PolicyViolationError(
        "PER_TX_LIMIT_EXCEEDED",
        `Requested amount (${request.requestedAmount}) exceeds per-transaction limit (${this.policy.maxSpendPerTransaction}).`
      );
    }

    // 6. Enforce Total Task Escrow Budget Bound (accounting for reserved and already spent budget)
    if (this.currentSpent + this.reservedBudget + request.requestedAmount > this.taskEscrowAllocation) {
      throw new PolicyViolationError(
        "BUDGET_EXHAUSTED",
        `Requested amount (${request.requestedAmount}) would exceed remaining task budget (${this.taskEscrowAllocation - (this.currentSpent + this.reservedBudget)}).`
      );
    }

    // Reserve the allocated amount for this active procurement
    this.reservedBudget += request.requestedAmount;

    const authorizationId = `auth_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    return {
      authorizationId,
      taskId: this.policy.taskId,
      capability: request.capability,
      providerId: request.providerId,
      authorizedAmount: request.requestedAmount,
      timestamp: Date.now(),
    };
  }

  /**
   * Releases previously reserved budget (e.g. if procurement failed or timed out).
   */
  public releaseReservation(amount: bigint): void {
    this.reservedBudget = this.reservedBudget >= amount ? this.reservedBudget - amount : 0n;
  }

  /**
   * Confirms payment deduction after verified execution.
   */
  public recordExpenditure(amount: bigint): void {
    if (this.currentSpent + amount > this.taskEscrowAllocation) {
      throw new PolicyViolationError(
        "OVERSPEND_ATTEMPT",
        `Cannot record expenditure (${amount}) exceeding allocated task escrow (${this.taskEscrowAllocation}).`
      );
    }
    this.currentSpent += amount;
    this.reservedBudget = this.reservedBudget >= amount ? this.reservedBudget - amount : 0n;
  }

  /**
   * Strict Security Guard: Rejects any attempt by agent code to call raw generic transfers.
   */
  public assertNoTreasuryAccess(attemptedAction: string): void {
    const forbidden = ["sendTransaction", "transfer", "drainTreasury", "exportKey", "signRawTx"];
    if (forbidden.some((op) => attemptedAction.toLowerCase().includes(op.toLowerCase()))) {
      throw new PolicyViolationError(
        "UNAUTHORIZED_WALLET_ACTION",
        `CRITICAL SECURITY VIOLATION: Agent attempted forbidden wallet action "${attemptedAction}". Agents have ZERO treasury access.`
      );
    }
  }
}
