/**
 * Pactra — Non-Custodial Autonomous Agent Client & API Abstraction
 *
 * Implements the official agent-facing interface for interacting with Pactra.
 *
 * CRITICAL SECURITY INVARIANT:
 * The agent receives bounded economic authority through a TaskPolicyEnvelope,
 * NOT user private keys, seed phrases, or raw transaction capabilities.
 *
 * All operations (discovery, quoting, procurement, evidence submission) are
 * validated against the TaskPolicy boundary.
 */

import { TaskPolicy, AgentCapability, PolicyViolationError } from "./policy.js";
import { AgentAuthorityManager, AgentOperatingBudget } from "./authority.js";
import { ServiceRegistry, ServiceDefinition } from "./registry.js";
import {
  ProcurementEngine,
  ProcurementRecord,
  ExecutionEvidence,
  ServiceRequestSpec,
} from "./procurement.js";
import { ObjectiveConditionSpec } from "./verifier.js";

export interface TaskPolicyEnvelope {
  readonly taskId: string;
  readonly objective: string;
  readonly policy: TaskPolicy;
  readonly allowedCapabilities: readonly AgentCapability[];
  readonly allowedProviders: readonly string[];
  readonly budget: AgentOperatingBudget;
  readonly completionConditions: ObjectiveConditionSpec;
}

export interface ServiceQuote {
  readonly serviceId: string;
  readonly providerCommitment: string;
  readonly category: AgentCapability;
  readonly unitPrice: bigint;
  readonly maxPrice: bigint;
  readonly withinPolicyBudget: boolean;
  readonly authorized: boolean;
  readonly reason?: string;
}

export interface AgentTaskStatus {
  readonly taskId: string;
  readonly objective: string;
  readonly currentSpent: bigint;
  readonly remainingBudget: bigint;
  readonly totalEscrowAllocation: bigint;
  readonly activeProcurementsCount: number;
  readonly isExpired: boolean;
}

export class PactraAgentClient {
  private readonly envelope: TaskPolicyEnvelope;
  private readonly authority: AgentAuthorityManager;
  private readonly registry: ServiceRegistry;
  private readonly engine: ProcurementEngine;

  constructor(
    envelope: TaskPolicyEnvelope,
    registry: ServiceRegistry,
    authority?: AgentAuthorityManager,
    engine?: ProcurementEngine
  ) {
    this.envelope = envelope;
    this.registry = registry;
    this.authority =
      authority ??
      new AgentAuthorityManager({
        userTreasuryTotal: envelope.budget.userTreasuryTotal,
        taskEscrowAllocation: envelope.budget.taskEscrowAllocation,
        policy: envelope.policy,
      });
    this.engine = engine ?? new ProcurementEngine(this.authority, this.registry);
  }

  /**
   * Discover available marketplace services filtered by capability or budget.
   */
  public async discoverServices(filter?: {
    category?: AgentCapability;
    maxUnitPrice?: bigint;
  }): Promise<ServiceDefinition[]> {
    let services = this.registry.listAllServices().filter((s) => s.status === "ACTIVE");

    if (filter?.category) {
      services = services.filter((s) => s.category === filter.category);
    }
    if (filter?.maxUnitPrice !== undefined) {
      services = services.filter((s) => s.unitPrice <= filter.maxUnitPrice!);
    }

    return services;
  }

  /**
   * Request a verified quote for a specific service against task policy bounds.
   */
  public async requestQuote(serviceId: string): Promise<ServiceQuote> {
    const service = this.registry.getService(serviceId);
    if (!service) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist.`);
    }

    const isCapabilityAllowed = this.envelope.allowedCapabilities.includes(service.category);
    const isProviderAllowed = this.envelope.allowedProviders.includes(service.providerCommitment);
    const budgetSnapshot = this.authority.getBudgetSnapshot();
    const isWithinBudget =
      service.unitPrice <= budgetSnapshot.remainingBudget &&
      service.unitPrice <= this.envelope.policy.maxSpendPerTransaction;

    let reason: string | undefined;
    if (!isCapabilityAllowed) reason = `Capability "${service.category}" not approved in policy.`;
    else if (!isProviderAllowed) reason = `Provider commitment not in policy allowlist.`;
    else if (!isWithinBudget) reason = `Unit price (${service.unitPrice}) exceeds spending limits.`;

    return {
      serviceId: service.serviceId,
      providerCommitment: service.providerCommitment,
      category: service.category,
      unitPrice: service.unitPrice,
      maxPrice: service.maxPrice,
      withinPolicyBudget: isWithinBudget,
      authorized: isCapabilityAllowed && isProviderAllowed && isWithinBudget,
      reason,
    };
  }

  /**
   * Request procurement of a service.
   * Enforces policy authorization and reserves escrow funds.
   */
  public async requestProcurement(
    serviceId: string,
    payloadHash?: string,
    customJobId?: string
  ): Promise<ProcurementRecord> {
    const service = this.registry.getService(serviceId);
    if (!service) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist.`);
    }

    const jobId = customJobId ?? `job_${service.category.toLowerCase()}_${Date.now().toString(36)}`;
    const spec: ServiceRequestSpec = {
      jobId,
      serviceId,
      capability: service.category,
      inputPayloadHash: payloadHash ?? `0xpayload_${serviceId}_${Date.now()}`,
      maxDurationSeconds: service.evidenceRequirement?.maxDurationSeconds ?? 3600,
    };

    return this.engine.requestService(spec);
  }

  /**
   * Submit execution evidence produced by an authorized service provider.
   */
  public async submitEvidence(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE" | "REPLAY_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    return this.engine.executeService(procurementId, simulateFailure);
  }

  /**
   * Query the current economic and operational status of the task.
   */
  public async getTaskStatus(): Promise<AgentTaskStatus> {
    const snapshot = this.authority.getBudgetSnapshot();
    const isExpired = Date.now() > this.envelope.policy.expirationTimestamp;

    return {
      taskId: this.envelope.taskId,
      objective: this.envelope.objective,
      currentSpent: snapshot.currentSpent,
      remainingBudget: snapshot.remainingBudget,
      totalEscrowAllocation: snapshot.taskEscrowAllocation,
      activeProcurementsCount: this.engine.listProcurements().length,
      isExpired,
    };
  }

  /**
   * Explicit security assertion: verifying that treasury bypasses cannot be invoked.
   */
  public assertNoTreasuryAccess(attemptedAction: string): void {
    this.authority.assertNoTreasuryAccess(attemptedAction);
  }
}
