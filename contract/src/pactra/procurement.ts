/**
 * Pactra — Micro-Procurement Engine
 *
 * Implements the resource procurement pipeline for autonomous agents.
 * Concrete Implementation: COMPUTE JOB
 *
 * Lifecycle:
 * Agent -> Request Service -> Policy Check -> Price Check -> Escrow Allocation -> Service Execution -> Evidence Generation
 */

import { sha256Hex } from "./cryptoUtils.js";
import { AgentAuthorityManager, AuthorizedProcurementToken } from "./authority.js";
import { ServiceRegistry } from "./registry.js";
import { PolicyViolationError, AgentCapability } from "./policy.js";

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

export interface ServiceRequestSpec {
  readonly jobId: string;
  readonly serviceId: string;
  readonly capability: AgentCapability;
  readonly inputPayloadHash: string;
  readonly parameters?: Record<string, unknown>;
  readonly maxDurationSeconds?: number;
}

export interface ComputeJobSpec extends ServiceRequestSpec {
  readonly inputDatasetHash: string;
  readonly instructions: string;
}

export interface ExecutionEvidence {
  readonly jobId: string;
  readonly providerCommitment: string;
  readonly outputHash: string;
  readonly executionDurationMs: number;
  readonly costIncurred: bigint;
  readonly evidenceSignature: string;
  readonly timestamp: number;
  readonly capability?: AgentCapability;
}

export interface ProcurementRecord {
  readonly procurementId: string;
  readonly jobSpec: ServiceRequestSpec;
  status: ProcurementStatus;
  authToken?: AuthorizedProcurementToken;
  evidence?: ExecutionEvidence;
  failureReason?: string;
  readonly requestedAt: number;
}

export class ProcurementEngine {
  private procurements = new Map<string, ProcurementRecord>();
  private spentJobIds = new Set<string>();
  private spentEvidenceHashes = new Set<string>();

  constructor(
    private readonly authority: AgentAuthorityManager,
    private readonly registry: ServiceRegistry
  ) {}

  public getAuthority(): AgentAuthorityManager {
    return this.authority;
  }

  public getRegistry(): ServiceRegistry {
    return this.registry;
  }

  /**
   * Generalized micro-procurement request for any registered capability service.
   */
  public async requestService(spec: ServiceRequestSpec): Promise<ProcurementRecord> {
    // 0. Anti-replay check for duplicate job ID
    if (this.spentJobIds.has(spec.jobId)) {
      throw new PolicyViolationError("DUPLICATE_PROCUREMENT", `Procurement with Job ID "${spec.jobId}" already exists.`);
    }

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
      capability: spec.capability,
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

    this.spentJobIds.add(spec.jobId);
    this.procurements.set(procurementId, record);
    return record;
  }

  /**
   * Concrete Compute Job helper (backwards-compatible with Level 2).
   */
  public async requestComputeJob(spec: {
    jobId: string;
    serviceId: string;
    inputDatasetHash: string;
    instructions: string;
    maxDurationSeconds?: number;
  }): Promise<ProcurementRecord> {
    return this.requestService({
      jobId: spec.jobId,
      serviceId: spec.serviceId,
      capability: "COMPUTE",
      inputPayloadHash: spec.inputDatasetHash,
      parameters: { instructions: spec.instructions },
      maxDurationSeconds: spec.maxDurationSeconds ?? 60,
    });
  }

  /**
   * Generalized service execution returning verified execution evidence.
   */
  public async executeService(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE" | "REPLAY_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    const record = this.procurements.get(procurementId);
    if (!record) {
      throw new PolicyViolationError("PROCUREMENT_NOT_FOUND", `Procurement "${procurementId}" does not exist.`);
    }

    if (record.status !== "SERVICE_ACCEPTED") {
      throw new PolicyViolationError(
        "INVALID_STATE_TRANSITION",
        `Cannot execute service in status "${record.status}". Expected SERVICE_ACCEPTED.`
      );
    }

    const service = this.registry.getService(record.jobSpec.serviceId)!;

    // Simulate failure paths if requested
    if (simulateFailure === "REJECTED") {
      record.status = "SERVICE_REJECTED";
      record.failureReason = "Provider rejected execution request due to insufficient capacity.";
      throw new PolicyViolationError("SERVICE_REJECTED", record.failureReason);
    }

    if (simulateFailure === "TIMEOUT") {
      record.status = "SERVICE_TIMEOUT";
      record.failureReason = "Service execution timed out before returning signed output.";
      throw new PolicyViolationError("SERVICE_TIMEOUT", record.failureReason);
    }

    record.status = "SERVICE_EXECUTED";

    // Produce deterministic result hash
    let outputHash: string;
    if (simulateFailure === "INVALID_EVIDENCE") {
      outputHash = "0xinvalid_tampered_output_hash_corrupt_data_0000000000000000000000";
    } else if (simulateFailure === "REPLAY_EVIDENCE") {
      outputHash = Array.from(this.spentEvidenceHashes)[0] ?? "0xspent_replayed_evidence_hash";
    } else {
      outputHash =
        "0x" +
        sha256Hex(
          `${record.jobSpec.jobId}:${record.jobSpec.inputPayloadHash}:${service.providerCommitment}:${record.jobSpec.capability}`
        );
    }

    // Anti-replay check for duplicate evidence
    if (this.spentEvidenceHashes.has(outputHash) && simulateFailure !== "INVALID_EVIDENCE") {
      throw new PolicyViolationError("REPLAY_ATTACK_PREVENTED", `Evidence hash "${outputHash}" has already been processed.`);
    }
    this.spentEvidenceHashes.add(outputHash);

    const sigPayload = `${outputHash}:${Date.now()}:${service.providerCommitment}`;
    const evidenceSignature = "0xsig_" + sha256Hex(sigPayload).slice(0, 32);

    const evidence: ExecutionEvidence = {
      jobId: record.jobSpec.jobId,
      providerCommitment: service.providerCommitment,
      outputHash,
      executionDurationMs: 1420,
      costIncurred: service.unitPrice,
      evidenceSignature,
      timestamp: Date.now(),
      capability: record.jobSpec.capability,
    };

    record.evidence = evidence;
    record.status = simulateFailure === "INVALID_EVIDENCE" ? "EVIDENCE_INVALID" : "EVIDENCE_SUBMITTED";
    return evidence;
  }

  /**
   * Concrete compute job execution (backwards-compatible with Level 2).
   */
  public async executeComputeJob(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    return this.executeService(procurementId, simulateFailure);
  }

  public getProcurement(procurementId: string): ProcurementRecord | null {
    return this.procurements.get(procurementId) ?? null;
  }

  public listProcurements(): ProcurementRecord[] {
    return Array.from(this.procurements.values());
  }
}
