/**
 * Pactra — Multi-Party Arbitration & Dispute Resolution Engine
 *
 * Implements a structured M-of-N threshold arbitration protocol for
 * subjective tasks, SLA disputes, and execution failures.
 *
 * Core Principle: The autonomous agent CANNOT declare its own success.
 * Disputed or subjective tasks require threshold cryptographic consensus
 * among designated verifiers/arbitrators.
 */

import { sha256Hex } from "./cryptoUtils.js";
import { PolicyViolationError } from "./policy.js";

export type ArbitrationVerdict = "UPHOLD_SETTLEMENT" | "REFUND_CREATOR" | "SPLIT_PENALTY";

export type DisputeStatus =
  | "PENDING_ARBITRATION"
  | "RESOLVED_SETTLE"
  | "RESOLVED_REFUND"
  | "RESOLVED_SPLIT"
  | "TIMED_OUT_REFUND";

export interface Arbitrator {
  readonly arbitratorId: string;
  readonly name: string;
  readonly publicKeyCommitment: string;
  readonly isHuman: boolean;
  readonly reputationScore: number;
}

export interface ArbitratorVote {
  readonly arbitratorId: string;
  readonly verdict: ArbitrationVerdict;
  readonly rationale: string;
  readonly signature: string;
  readonly votedAt: number;
}

export interface MultiPartyDispute {
  readonly disputeId: string;
  readonly procurementId: string;
  readonly taskId: string;
  readonly claimant: "CREATOR" | "PROVIDER" | "AGENT" | "AUTOMATED_VERIFIER";
  readonly reason: string;
  readonly disputedAmount: bigint;
  readonly evidencePayloadHash: string;
  readonly requiredThreshold: number; // M of N
  readonly timeoutTimestamp: number;
  readonly createdAt: number;
  status: DisputeStatus;
  votes: Map<string, ArbitratorVote>;
  resolutionSummary?: string;
  resolvedAt?: number;
}

export class ArbitrationBoard {
  private arbitrators = new Map<string, Arbitrator>();
  private disputes = new Map<string, MultiPartyDispute>();

  constructor(
    initialArbitrators: Arbitrator[] = [],
    private readonly defaultThreshold: number = 2
  ) {
    for (const arb of initialArbitrators) {
      this.arbitrators.set(arb.arbitratorId, arb);
    }
  }

  public registerArbitrator(arbitrator: Arbitrator): void {
    this.arbitrators.set(arbitrator.arbitratorId, { ...arbitrator });
  }

  public getArbitrators(): Arbitrator[] {
    return Array.from(this.arbitrators.values());
  }

  public openDispute(params: {
    procurementId: string;
    taskId: string;
    claimant: "CREATOR" | "PROVIDER" | "AGENT" | "AUTOMATED_VERIFIER";
    reason: string;
    disputedAmount: bigint;
    evidencePayloadHash: string;
    timeoutDurationSeconds?: number;
    requiredThreshold?: number;
  }): MultiPartyDispute {
    const disputeId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const totalArbitrators = this.arbitrators.size;
    const threshold = params.requiredThreshold ?? Math.min(this.defaultThreshold, totalArbitrators);

    if (threshold <= 0 || threshold > totalArbitrators) {
      throw new PolicyViolationError(
        "INVALID_THRESHOLD",
        `Arbitration threshold (${threshold}) must be between 1 and total registered arbitrators (${totalArbitrators}).`
      );
    }

    const timeoutDuration = (params.timeoutDurationSeconds ?? 3600) * 1000;
    const timeoutTimestamp = Date.now() + timeoutDuration;

    const dispute: MultiPartyDispute = {
      disputeId,
      procurementId: params.procurementId,
      taskId: params.taskId,
      claimant: params.claimant,
      reason: params.reason,
      disputedAmount: params.disputedAmount,
      evidencePayloadHash: params.evidencePayloadHash,
      requiredThreshold: threshold,
      timeoutTimestamp,
      createdAt: Date.now(),
      status: "PENDING_ARBITRATION",
      votes: new Map(),
    };

    this.disputes.set(disputeId, dispute);
    return dispute;
  }

  public castVote(
    disputeId: string,
    arbitratorId: string,
    verdict: ArbitrationVerdict,
    rationale: string
  ): { resolved: boolean; status: DisputeStatus; dispute: MultiPartyDispute } {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new PolicyViolationError("DISPUTE_NOT_FOUND", `Dispute "${disputeId}" not found.`);
    }

    if (dispute.status !== "PENDING_ARBITRATION") {
      throw new PolicyViolationError(
        "DISPUTE_ALREADY_RESOLVED",
        `Dispute "${disputeId}" is already closed in status: ${dispute.status}.`
      );
    }

    // Check timeout
    if (Date.now() > dispute.timeoutTimestamp) {
      dispute.status = "TIMED_OUT_REFUND";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = "Arbitration voting window expired without quorum. Funds returned to creator.";
      return { resolved: true, status: dispute.status, dispute };
    }

    const arbitrator = this.arbitrators.get(arbitratorId);
    if (!arbitrator) {
      throw new PolicyViolationError("UNAUTHORIZED_ARBITRATOR", `Arbitrator "${arbitratorId}" is not registered on the board.`);
    }

    if (dispute.votes.has(arbitratorId)) {
      throw new PolicyViolationError("DUPLICATE_VOTE", `Arbitrator "${arbitratorId}" has already cast a vote for this dispute.`);
    }

    const signature = "0xarbsig_" + sha256Hex(`${disputeId}:${arbitratorId}:${verdict}:${rationale}`);

    const vote: ArbitratorVote = {
      arbitratorId,
      verdict,
      rationale,
      signature,
      votedAt: Date.now(),
    };

    dispute.votes.set(arbitratorId, vote);

    // Tally votes
    const votesList = Array.from(dispute.votes.values());
    const upholdCount = votesList.filter((v) => v.verdict === "UPHOLD_SETTLEMENT").length;
    const refundCount = votesList.filter((v) => v.verdict === "REFUND_CREATOR").length;
    const splitCount = votesList.filter((v) => v.verdict === "SPLIT_PENALTY").length;

    if (upholdCount >= dispute.requiredThreshold) {
      dispute.status = "RESOLVED_SETTLE";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Arbitration threshold reached (${upholdCount}/${dispute.requiredThreshold} UPHOLD). Settlement confirmed to provider.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    if (refundCount >= dispute.requiredThreshold) {
      dispute.status = "RESOLVED_REFUND";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Arbitration threshold reached (${refundCount}/${dispute.requiredThreshold} REFUND). Funds returned to creator.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    if (splitCount >= dispute.requiredThreshold) {
      dispute.status = "RESOLVED_SPLIT";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Arbitration threshold reached (${splitCount}/${dispute.requiredThreshold} SPLIT). Partial penalty applied.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    return { resolved: false, status: dispute.status, dispute };
  }

  public checkExpiry(disputeId: string): DisputeStatus {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) return "TIMED_OUT_REFUND";
    if (dispute.status === "PENDING_ARBITRATION" && Date.now() > dispute.timeoutTimestamp) {
      dispute.status = "TIMED_OUT_REFUND";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = "Voting expired. Default safe resolution applied: Refund to Task Creator.";
    }
    return dispute.status;
  }

  public getDispute(disputeId: string): MultiPartyDispute | null {
    return this.disputes.get(disputeId) ?? null;
  }

  public listDisputes(): MultiPartyDispute[] {
    return Array.from(this.disputes.values());
  }
}

/**
 * Default multi-party arbitration board with 3 independent verifiers:
 * 2 Automated Oracle Nodes + 1 Independent Human Arbitrator.
 */
export function createDefaultArbitrationBoard(): ArbitrationBoard {
  return new ArbitrationBoard(
    [
      {
        arbitratorId: "arb_oracle_node_01",
        name: "Midnight Automated Oracle Verifier 01",
        publicKeyCommitment: "0xarb_oracle_01_commitment_7a810f",
        isHuman: false,
        reputationScore: 99,
      },
      {
        arbitratorId: "arb_oracle_node_02",
        name: "Decentralized Compute SLA Oracle 02",
        publicKeyCommitment: "0xarb_oracle_02_commitment_3c921e",
        isHuman: false,
        reputationScore: 98,
      },
      {
        arbitratorId: "arb_human_panel_03",
        name: "Certified Human Domain Arbitrator",
        publicKeyCommitment: "0xarb_human_03_commitment_55b40d",
        isHuman: true,
        reputationScore: 100,
      },
    ],
    2 // 2-of-3 threshold
  );
}
