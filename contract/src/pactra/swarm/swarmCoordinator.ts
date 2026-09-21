/**
 * Pactra — Controlled Multi-Agent Swarm Economy Coordinator
 *
 * Implements bounded agent-to-agent sub-delegation trees:
 * Planner Agent ──► Procurement Agent ──► Specialist Agents (Compute, Storage, Data, etc.)
 *
 * CRITICAL SECURITY INVARIANT:
 * Every sub-delegated allowance is bounded by the root TaskPolicy.
 * The sum of sub-delegations can NEVER exceed the root task budget.
 * Sub-agents NEVER inherit user wallet access or signing keys.
 */

import { TaskPolicyEnvelope, AgentCapability, PolicyViolationError } from "../policy.js";
import { ServiceRegistry } from "../registry.js";
import { CapabilityBroker, BoundedProcurementIntent } from "../runtime/capabilityBroker.js";

export type SwarmAgentRole = "PLANNER" | "PROCUREMENT" | "SPECIALIST_WORKER" | "VERIFIER";

export interface SubDelegatedBudget {
  readonly parentTaskId: string;
  readonly subDelegationId: string;
  readonly delegateAgentId: string;
  readonly role: SwarmAgentRole;
  readonly allowedCapability: AgentCapability;
  readonly allocatedBudget: bigint;
  spentBudget: bigint;
  readonly createdAt: number;
}

export interface SwarmProcurementResult {
  readonly subDelegationId: string;
  readonly serviceId: string;
  readonly amountSpent: bigint;
  readonly evidenceHash: string;
  readonly status: "SUCCESS" | "FAILED";
}

export class PactraSwarmCoordinator {
  private delegations = new Map<string, SubDelegatedBudget>();
  private readonly rootBroker: CapabilityBroker;
  private readonly rootEnvelope: TaskPolicyEnvelope;
  private totalAllocatedSubBudget: bigint = 0n;

  constructor(rootBroker: CapabilityBroker) {
    this.rootBroker = rootBroker;
    this.rootEnvelope = rootBroker.getPolicyEnvelope();
  }

  /**
   * Delegates a bounded sub-budget to a specialized downstream agent.
   */
  public delegateSubTask(params: {
    delegateAgentId: string;
    role: SwarmAgentRole;
    allowedCapability: AgentCapability;
    allocatedBudget: bigint;
  }): SubDelegatedBudget {
    // 1. Verify capability is approved in root policy
    if (!this.rootEnvelope.policy.approvedCategories.includes(params.allowedCapability)) {
      throw new PolicyViolationError(
        "UNAPPROVED_CATEGORY",
        `Cannot sub-delegate unapproved capability "${params.allowedCapability}".`
      );
    }

    // 2. Verify sub-delegation does not exceed remaining root budget
    const maxBudget = this.rootEnvelope.policy.maxTotalBudget;
    if (this.totalAllocatedSubBudget + params.allocatedBudget > maxBudget) {
      throw new PolicyViolationError(
        "SWARM_BUDGET_OVERALLOCATION",
        `Sub-delegation allocation (${params.allocatedBudget}) would exceed root task budget limit (${maxBudget - this.totalAllocatedSubBudget} remaining).`
      );
    }

    const subDelegationId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const delegation: SubDelegatedBudget = {
      parentTaskId: this.rootEnvelope.policy.taskId,
      subDelegationId,
      delegateAgentId: params.delegateAgentId,
      role: params.role,
      allowedCapability: params.allowedCapability,
      allocatedBudget: params.allocatedBudget,
      spentBudget: 0n,
      createdAt: Date.now(),
    };

    this.delegations.set(subDelegationId, delegation);
    this.totalAllocatedSubBudget += params.allocatedBudget;

    return delegation;
  }

  /**
   * Executes a procurement on behalf of a sub-delegated agent.
   */
  public executeSubProcurement(
    subDelegationId: string,
    serviceId: string,
    payloadHash?: string
  ): SwarmProcurementResult {
    const delegation = this.delegations.get(subDelegationId);
    if (!delegation) {
      throw new PolicyViolationError("DELEGATION_NOT_FOUND", `Sub-delegation "${subDelegationId}" does not exist.`);
    }

    const intent: BoundedProcurementIntent = {
      serviceCategory: delegation.allowedCapability,
      serviceId,
      maxAcceptablePrice: delegation.allocatedBudget - delegation.spentBudget,
      payloadHash,
    };

    // Authorize through root capability broker
    const { token, quote } = this.rootBroker.authorizeAction(intent);

    if (delegation.spentBudget + quote.unitPrice > delegation.allocatedBudget) {
      this.rootBroker.releaseReservation(token.authorizationId, quote.unitPrice);
      throw new PolicyViolationError(
        "SUB_BUDGET_EXCEEDED",
        `Procurement cost (${quote.unitPrice}) exceeds sub-delegated budget (${delegation.allocatedBudget - delegation.spentBudget} remaining).`
      );
    }

    // Confirm settlement
    this.rootBroker.confirmSettlement(token.authorizationId, quote.unitPrice);
    delegation.spentBudget += quote.unitPrice;

    return {
      subDelegationId,
      serviceId,
      amountSpent: quote.unitPrice,
      evidenceHash: `0xevid_${subDelegationId}_${token.authorizationId}`,
      status: "SUCCESS",
    };
  }

  public getDelegation(subDelegationId: string): SubDelegatedBudget | undefined {
    return this.delegations.get(subDelegationId);
  }

  public getTotalAllocatedSubBudget(): bigint {
    return this.totalAllocatedSubBudget;
  }
}
