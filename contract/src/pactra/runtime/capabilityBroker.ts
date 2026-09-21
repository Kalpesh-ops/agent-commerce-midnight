/**
 * Pactra — Non-Custodial Capability Broker
 *
 * Implements the security barrier between autonomous agent runtime logic
 * and economic procurement authority.
 *
 * CRITICAL SECURITY INVARIANT:
 * The Capability Broker NEVER holds, requests, or forwards user private keys,
 * seed phrases, or generic transaction broadcasting capabilities.
 * Every requested operation must validate against an immutable TaskPolicy.
 */

import { AgentCapability, TaskPolicyEnvelope, PolicyViolationError } from "../policy.js";
import { AgentAuthorityManager } from "../authority.js";
import { ServiceRegistry, ServiceListing } from "../registry.js";
import { ProcurementRecord, ExecutionEvidence } from "../procurement.js";

export interface BrokerServiceQuote {
  readonly quoteId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly unitPrice: bigint;
  readonly quotedAt: number;
  readonly validUntil: number;
  readonly slaTerms?: Record<string, unknown>;
}

export interface BoundedProcurementIntent {
  readonly serviceCategory: AgentCapability;
  readonly serviceId: string;
  readonly maxAcceptablePrice: bigint;
  readonly payloadHash?: string;
  readonly customJobId?: string;
}

export class CapabilityBroker {
  private readonly authority: AgentAuthorityManager;
  private readonly registry: ServiceRegistry;
  private readonly envelope: TaskPolicyEnvelope;

  constructor(envelope: TaskPolicyEnvelope, registry: ServiceRegistry) {
    this.envelope = envelope;
    this.registry = registry;
    this.authority = new AgentAuthorityManager({
      userTreasuryTotal: envelope.policy.maxTotalBudget * 2n, // safety factor
      taskEscrowAllocation: envelope.policy.maxTotalBudget,
      policy: envelope.policy,
    });
  }

  /**
   * Return the immutable policy envelope anchoring this broker.
   */
  public getPolicyEnvelope(): TaskPolicyEnvelope {
    return this.envelope;
  }

  /**
   * Discovers authorized services matching the requested capability.
   * Disallows querying services outside the policy's approved categories.
   */
  public discoverPermittedServices(category: AgentCapability): readonly ServiceListing[] {
    if (!this.envelope.policy.approvedCategories.includes(category)) {
      throw new PolicyViolationError(
        "UNAPPROVED_CATEGORY",
        `Capability "${category}" is not approved in task policy [${this.envelope.policy.approvedCategories.join(", ")}].`
      );
    }
    return this.registry.getServicesByCategory(category).filter((s) => s.status === "ACTIVE");
  }

  /**
   * Evaluates a service quote against per-call and remaining budget limits.
   */
  public evaluateQuote(serviceId: string): { quote: BrokerServiceQuote; isPermitted: boolean } {
    const listing = this.registry.getService(serviceId);
    if (!listing) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist in registry.`);
    }

    if (!this.envelope.policy.approvedCategories.includes(listing.category)) {
      throw new PolicyViolationError(
        "UNAPPROVED_CATEGORY",
        `Service category "${listing.category}" is not approved in task policy.`
      );
    }

    if (this.envelope.policy.approvedProviders.length > 0 && !this.envelope.policy.approvedProviders.includes(serviceId)) {
      throw new PolicyViolationError(
        "UNAPPROVED_PROVIDER",
        `Service "${serviceId}" is not in approved providers allowlist.`
      );
    }

    const price = (listing as any).pricing?.unitPrice ?? listing.unitPrice;
    if (price > this.envelope.policy.maxSpendPerTransaction) {
      throw new PolicyViolationError(
        "PER_TRANSACTION_LIMIT_EXCEEDED",
        `Service price (${price}) exceeds per-transaction limit (${this.envelope.policy.maxSpendPerTransaction}).`
      );
    }

    const snapshot = this.authority.getBudgetSnapshot();
    if (price > snapshot.remainingBudget) {
      throw new PolicyViolationError(
        "INSUFFICIENT_TASK_BUDGET",
        `Service price (${price}) exceeds remaining task budget (${snapshot.remainingBudget}).`
      );
    }

    const quote: BrokerServiceQuote = {
      quoteId: `quote_${Date.now()}_${serviceId}`,
      serviceId,
      providerId: (listing as any).providerPublicKey ?? listing.providerCommitment,
      unitPrice: price,
      quotedAt: Date.now(),
      validUntil: Date.now() + 60000,
      slaTerms: (listing as any).sla ?? (listing.evidenceRequirement ? { maxExecutionDurationMs: listing.evidenceRequirement.maxDurationSeconds * 1000 } : undefined),
    };

    return { quote, isPermitted: true };
  }

  /**
   * Reserves bounded authority and returns an authorized procurement token.
   */
  public authorizeAction(intent: BoundedProcurementIntent) {
    const { quote } = this.evaluateQuote(intent.serviceId);

    const token = this.authority.authorizeProcurement({
      providerId: intent.serviceId,
      serviceCategory: intent.serviceCategory,
      capability: intent.serviceCategory,
      requestedAmount: quote.unitPrice,
      objectiveRef: `objective_${this.envelope.policy.taskId}`,
    });

    return { token, quote };
  }

  /**
   * Finalizes spending upon verified completion evidence.
   */
  public confirmSettlement(procurementId: string, amount: bigint) {
    this.authority.recordExpenditure(amount);
  }

  /**
   * Releases reserved authority in the event of an execution failure or refund.
   */
  public releaseReservation(procurementId: string, amount: bigint) {
    this.authority.releaseReservation(amount);
  }

  /**
   * Current budget snapshot.
   */
  public getBudgetStatus() {
    return this.authority.getBudgetSnapshot();
  }
}
