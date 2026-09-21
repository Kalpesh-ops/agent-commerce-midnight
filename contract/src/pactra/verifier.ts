/**
 * Pactra — Objective Completion Verifier & Dispute Engine
 *
 * Evaluates whether execution evidence satisfies structured objective conditions
 * before enabling escrow settlement on the Midnight Network.
 *
 * NOTE: For subjective or non-deterministic objectives, explicitly marks
 * `HUMAN / EXTERNAL VERIFIER REQUIRED`. The agent CANNOT declare itself successful.
 */

import { sha256Hex } from "./cryptoUtils.js";
import { ExecutionEvidence } from "./procurement.js";

export interface ObjectiveConditionSpec {
  readonly expectedJobId?: string;
  readonly expectedProviderCommitment?: string;
  readonly expectedResultCommitment?: string;
  readonly maxAllowedCost?: bigint;
  readonly isSubjectiveTask?: boolean;
  readonly externalVerifierRequired?: boolean;
  readonly verifierDescription?: string;
  readonly conditionHash?: string;
  readonly requiredArtifacts?: readonly string[];
  readonly verificationMethod?: string;
}

export interface VerificationResult {
  readonly verified: boolean;
  readonly conditionCommitment: string;
  readonly completionHash: string;
  readonly checks: {
    readonly jobIdMatches: boolean;
    readonly providerAuthorized: boolean;
    readonly withinCostBound: boolean;
    readonly resultMatchesCommitment: boolean;
    readonly evidenceFormatValid: boolean;
  };
  readonly requiresHumanSignoff: boolean;
  readonly failureReason?: string;
  readonly verifiedAt: number;
}

export interface DisputeRecord {
  readonly disputeId: string;
  readonly procurementId: string;
  readonly reason: string;
  readonly disputedAt: number;
  readonly resolvedState: "DISPUTED" | "REFUNDED";
}

export class CompletionVerifier {
  private disputes = new Map<string, DisputeRecord>();

  /**
   * Computes the 32-byte cryptographic commitment for the objective completion conditions.
   * This hash is committed to the Midnight contract during `createTask`.
   */
  public computeConditionCommitment(spec: ObjectiveConditionSpec): string {
    const payload = JSON.stringify({
      expectedJobId: spec.expectedJobId ?? "",
      expectedProviderCommitment: spec.expectedProviderCommitment ?? "",
      expectedResultCommitment: spec.expectedResultCommitment ?? "any_valid_hash",
      maxAllowedCost: (spec.maxAllowedCost ?? 0n).toString(),
      isSubjective: Boolean(spec.isSubjectiveTask),
    });
    return "0x" + sha256Hex(payload);
  }

  /**
   * Objectively evaluates provider evidence against the task condition specification.
   */
  public verifyExecution(
    spec: ObjectiveConditionSpec,
    evidence?: ExecutionEvidence
  ): VerificationResult {
    const conditionCommitment = this.computeConditionCommitment(spec);

    if (!evidence) {
      return {
        verified: false,
        conditionCommitment,
        completionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        checks: {
          jobIdMatches: false,
          providerAuthorized: false,
          withinCostBound: false,
          resultMatchesCommitment: false,
          evidenceFormatValid: false,
        },
        requiresHumanSignoff: Boolean(spec.externalVerifierRequired),
        failureReason: "No execution evidence was submitted.",
        verifiedAt: Date.now(),
      };
    }

    const jobIdMatches = !spec.expectedJobId || evidence.jobId === spec.expectedJobId;
    const providerAuthorized = !spec.expectedProviderCommitment || evidence.providerCommitment === spec.expectedProviderCommitment;
    const withinCostBound = spec.maxAllowedCost !== undefined ? evidence.costIncurred <= spec.maxAllowedCost : true;
    const evidenceFormatValid =
      Boolean(evidence.outputHash) &&
      evidence.outputHash.startsWith("0x") &&
      Boolean(evidence.evidenceSignature);

    let resultMatchesCommitment = true;
    if (spec.expectedResultCommitment) {
      resultMatchesCommitment = evidence.outputHash.toLowerCase() === spec.expectedResultCommitment.toLowerCase();
    }

    const allPassed =
      jobIdMatches &&
      providerAuthorized &&
      withinCostBound &&
      evidenceFormatValid &&
      resultMatchesCommitment;

    let failureReason: string | undefined;
    if (!jobIdMatches) failureReason = `Job ID mismatch: got "${evidence.jobId}", expected "${spec.expectedJobId}".`;
    else if (!providerAuthorized) failureReason = `Provider not authorized for condition.`;
    else if (!withinCostBound) failureReason = `Cost (${evidence.costIncurred}) exceeded condition limit (${spec.maxAllowedCost}).`;
    else if (!resultMatchesCommitment) failureReason = `Result hash does not match expected commitment.`;
    else if (!evidenceFormatValid) failureReason = `Corrupt or invalid evidence signature payload.`;

    return {
      verified: allPassed && !spec.isSubjectiveTask,
      conditionCommitment,
      completionHash: evidence.outputHash,
      checks: {
        jobIdMatches,
        providerAuthorized,
        withinCostBound,
        resultMatchesCommitment,
        evidenceFormatValid,
      },
      requiresHumanSignoff: Boolean(spec.isSubjectiveTask || spec.externalVerifierRequired),
      failureReason,
      verifiedAt: Date.now(),
    };
  }

  /**
   * Raises a formal dispute if service execution failed, evidence is invalid, or SLA is breached.
   */
  public raiseDispute(procurementId: string, reason: string): DisputeRecord {
    const disputeId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: DisputeRecord = {
      disputeId,
      procurementId,
      reason,
      disputedAt: Date.now(),
      resolvedState: "REFUNDED",
    };
    this.disputes.set(disputeId, record);
    return record;
  }

  public getDispute(disputeId: string): DisputeRecord | null {
    return this.disputes.get(disputeId) ?? null;
  }
}
