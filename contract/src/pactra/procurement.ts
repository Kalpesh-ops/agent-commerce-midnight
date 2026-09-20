/**
 * Pactra — Micro-Procurement Engine
 *
 * Implements the resource procurement pipeline for autonomous agents.
 * Concrete Implementation: COMPUTE JOB
 *
 * Lifecycle:
 * Agent -> Request Service -> Policy Check -> Price Check -> Escrow Allocation -> Service Execution -> Evidence Generation
 */

import { createHash } from "node:crypto";
import { AgentAuthorityManager, AuthorizedProcurementToken } from "./authority.js";
import { ServiceRegistry } from "./registry.js";
import { PolicyViolationError } from "./policy.js";

export type ProcurementStatus =
  | "SERVICE_REQUESTED"
  | "SERVICE_ACCEPTED"
  | "SERVICE_EXECUTED"
  | "EVIDENCE_SUBMITTED"
  | "VERIFIED"
  | "SETTLED"
  | "SERVICE_REJECTED"
  | "SERVICE_TIMEOUT"
  | "EVIDENCE_INVALID"
  | "VERIFICATION_FAILED"
  | "DISPUTED"
  | "REFUNDED";

export interface ComputeJobSpec {
  readonly jobId: string;
  readonly serviceId: string;
  readonly inputDatasetHash: string;
  readonly instructions: string;
  readonly maxDurationSeconds: number;
}

export interface ExecutionEvidence {
  readonly jobId: string;
  readonly providerCommitment: string;
  readonly outputHash: string;
  readonly executionDurationMs: number;
  readonly costIncurred: bigint;
  readonly evidenceSignature: string;
  readonly timestamp: number;
}

export interface ProcurementRecord {
  readonly procurementId: string;
  readonly jobSpec: ComputeJobSpec;
  status: ProcurementStatus;
  authToken?: AuthorizedProcurementToken;
  evidence?: ExecutionEvidence;
  failureReason?: string;
  readonly requestedAt: number;
}

export class ProcurementEngine {
  private procurements = new Map<string, ProcurementRecord>();

  constructor(
    private readonly authority: AgentAuthorityManager,
    private readonly registry: ServiceRegistry
  ) {}

  public getAuthorityManager(): AgentAuthorityManager {
    return this.authority;
  }

  public getRegistry(): ServiceRegistry {
    return this.registry;
  }

  /**
   * Initiates a micro-procurement request for a concrete Compute Job.
   */
  public async requestComputeJob(spec: ComputeJobSpec): Promise<ProcurementRecord> {
    // 1. Verify service exists and is active in registry
    const service = this.registry.getService(spec.serviceId);
    if (!service) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${spec.serviceId}" is not in the registry.`);
    }
    if (service.status !== "ACTIVE") {
      throw new PolicyViolationError("SERVICE_INACTIVE", `Service "${spec.serviceId}" is currently ${service.status}.`);
    }

    // 2. Validate price against service registry max bounds
    const quoteCheck = this.registry.validateServiceQuote(spec.serviceId, service.unitPrice);
    if (!quoteCheck.valid) {
      throw new PolicyViolationError("PRICE_CHECK_FAILED", quoteCheck.reason || "Invalid service price quote.");
    }

    // 3. Request authorization from policy authority manager
    const authToken = this.authority.authorizeProcurement({
      capability: "COMPUTE",
      providerId: service.providerCommitment,
      requestedAmount: service.unitPrice,
      serviceCategory: service.category,
      objectiveRef: spec.jobId,
    });

    const procurementId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: ProcurementRecord = {
      procurementId,
      jobSpec: spec,
      status: "SERVICE_ACCEPTED",
      authToken,
      requestedAt: Date.now(),
    };

    this.procurements.set(procurementId, record);
    return record;
  }

  /**
   * Simulates execution by the authorized compute provider and returns execution evidence.
   */
  public async executeComputeJob(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    const record = this.procurements.get(procurementId);
    if (!record) {
      throw new PolicyViolationError("PROCUREMENT_NOT_FOUND", `Procurement "${procurementId}" does not exist.`);
    }

    if (record.status !== "SERVICE_ACCEPTED") {
      throw new PolicyViolationError(
        "INVALID_STATE_TRANSITION",
        `Cannot execute job in status "${record.status}". Expected SERVICE_ACCEPTED.`
      );
    }

    const service = this.registry.getService(record.jobSpec.serviceId)!;

    // Simulate failure paths if requested
    if (simulateFailure === "REJECTED") {
      record.status = "SERVICE_REJECTED";
      record.failureReason = "Provider rejected execution request due to insufficient compute capacity.";
      throw new PolicyViolationError("SERVICE_REJECTED", record.failureReason);
    }

    if (simulateFailure === "TIMEOUT") {
      record.status = "SERVICE_TIMEOUT";
      record.failureReason = "Compute worker execution timed out before returning signed output.";
      throw new PolicyViolationError("SERVICE_TIMEOUT", record.failureReason);
    }

    record.status = "SERVICE_EXECUTED";

    // Produce deterministic result hash
    let outputHash: string;
    if (simulateFailure === "INVALID_EVIDENCE") {
      outputHash = "0xinvalid_tampered_output_hash_corrupt_data_0000000000000000000000";
    } else {
      const hasher = createHash("sha256");
      hasher.update(`${record.jobSpec.jobId}:${record.jobSpec.inputDatasetHash}:${service.providerCommitment}`);
      outputHash = "0x" + hasher.digest("hex");
    }

    const sigPayload = `${outputHash}:${Date.now()}:${service.providerCommitment}`;
    const evidenceSignature = "0xsig_" + createHash("sha256").update(sigPayload).digest("hex").slice(0, 32);

    const evidence: ExecutionEvidence = {
      jobId: record.jobSpec.jobId,
      providerCommitment: service.providerCommitment,
      outputHash,
      executionDurationMs: 1420,
      costIncurred: service.unitPrice,
      evidenceSignature,
      timestamp: Date.now(),
    };

    record.evidence = evidence;
    record.status = simulateFailure === "INVALID_EVIDENCE" ? "EVIDENCE_INVALID" : "EVIDENCE_SUBMITTED";

    return evidence;
  }

  public getProcurement(procurementId: string): ProcurementRecord | null {
    return this.procurements.get(procurementId) ?? null;
  }

  public listProcurements(): ProcurementRecord[] {
    return Array.from(this.procurements.values());
  }
}
