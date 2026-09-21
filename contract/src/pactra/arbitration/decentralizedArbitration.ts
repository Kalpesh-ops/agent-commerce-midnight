/**
 * Pactra — Decentralized Arbitration & Staking Engine
 *
 * Implements a decentralized dispute resolution protocol with economic staking,
 * arbitrator lifecycle tracking, slashing for protocol violations, and M-of-N
 * threshold consensus.
 *
 * ARCHITECTURAL DEMARCATION:
 * 1. Protocol-Enforced Arbitration: Cryptographically validated consensus on-chain.
 * 2. Designated Preprod Arbitrators: Fixed testnet keys for Level 1-5 testing.
 * 3. Decentralized Production Arbitration: Staked validator pool with economic penalties.
 */

import { sha256Hex } from "../cryptoUtils.js";
import { PolicyViolationError } from "../policy.js";

export type ArbitratorLifecycleState =
  | "REGISTERED"
  | "ACTIVE"
  | "DISPUTED"
  | "SLASHED"
  | "WITHDRAWING"
  | "WITHDRAWN";

export type DecentralizedVerdict = "UPHOLD_SETTLEMENT" | "REFUND_CREATOR" | "SPLIT_PENALTY";

export type DisputeResolutionState =
  | "PENDING_ARBITRATION"
  | "RESOLVED_SETTLE"
  | "RESOLVED_REFUND"
  | "RESOLVED_SPLIT"
  | "TIMED_OUT_REFUND";

export interface StakedArbitrator {
  readonly arbitratorId: string;
  readonly name: string;
  readonly publicKeyCommitment: string;
  stakedAmount: bigint;
  state: ArbitratorLifecycleState;
  reputationScore: number;
  readonly joinedAt: number;
  withdrawalRequestedAt?: number;
  slashingReason?: string;
}

export interface DecentralizedVote {
  readonly arbitratorId: string;
  readonly verdict: DecentralizedVerdict;
  readonly rationale: string;
  readonly signature: string;
  readonly votedAt: number;
}

export interface DecentralizedDispute {
  readonly disputeId: string;
  readonly taskId: string;
  readonly procurementId: string;
  readonly disputedAmount: bigint;
  readonly requiredThreshold: number; // M of N (e.g. 2 of 3)
  readonly timeoutTimestamp: number;
  readonly eligibleArbitratorIds: readonly string[];
  status: DisputeResolutionState;
  votes: Map<string, DecentralizedVote>;
  resolutionSummary?: string;
  resolvedAt?: number;
}

export interface StakingProtocolConfig {
  readonly minStakeAmount: bigint;
  readonly withdrawalLockDurationMs: number;
  readonly slashingPenaltyPercentage: number; // 0 - 100
  readonly defaultThreshold: number;
}

export class DecentralizedArbitrationEngine {
  private arbitrators = new Map<string, StakedArbitrator>();
  private disputes = new Map<string, DecentralizedDispute>();
  private slashedTreasury: bigint = 0n;

  constructor(private readonly config: StakingProtocolConfig) {}

  /**
   * Registers a new arbitrator with an initial staked deposit.
   */
  public registerArbitrator(params: {
    arbitratorId: string;
    name: string;
    publicKeyCommitment: string;
    initialStake: bigint;
  }): StakedArbitrator {
    if (this.arbitrators.has(params.arbitratorId)) {
      throw new PolicyViolationError(
        "ARBITRATOR_EXISTS",
        `Arbitrator "${params.arbitratorId}" is already registered.`
      );
    }

    const state: ArbitratorLifecycleState =
      params.initialStake >= this.config.minStakeAmount ? "ACTIVE" : "REGISTERED";

    const arb: StakedArbitrator = {
      arbitratorId: params.arbitratorId,
      name: params.name,
      publicKeyCommitment: params.publicKeyCommitment,
      stakedAmount: params.initialStake,
      state,
      reputationScore: 100,
      joinedAt: Date.now(),
    };

    this.arbitrators.set(params.arbitratorId, arb);
    return arb;
  }

  /**
   * Deposits additional stake to activate an arbitrator.
   */
  public depositStake(arbitratorId: string, amount: bigint): StakedArbitrator {
    const arb = this.getArbitratorOrThrow(arbitratorId);

    if (arb.state === "SLASHED" || arb.state === "WITHDRAWN") {
      throw new PolicyViolationError(
        "INVALID_ARBITRATOR_STATE",
        `Cannot deposit stake for arbitrator in ${arb.state} state.`
      );
    }

    arb.stakedAmount += amount;
    if (arb.stakedAmount >= this.config.minStakeAmount && arb.state === "REGISTERED") {
      arb.state = "ACTIVE";
    }

    return arb;
  }

  /**
   * Requests stake withdrawal, placing the arbitrator in WITHDRAWING status.
   */
  public requestWithdrawal(arbitratorId: string): StakedArbitrator {
    const arb = this.getArbitratorOrThrow(arbitratorId);

    if (arb.state !== "ACTIVE") {
      throw new PolicyViolationError(
        "CANNOT_WITHDRAW",
        `Arbitrator must be in ACTIVE state to request withdrawal (currently: ${arb.state}).`
      );
    }

    arb.state = "WITHDRAWING";
    arb.withdrawalRequestedAt = Date.now();
    return arb;
  }

  /**
   * Finalizes stake withdrawal after the mandatory lock period.
   */
  public finalizeWithdrawal(arbitratorId: string): { returnedStake: bigint; arbitrator: StakedArbitrator } {
    const arb = this.getArbitratorOrThrow(arbitratorId);

    if (arb.state !== "WITHDRAWING" || !arb.withdrawalRequestedAt) {
      throw new PolicyViolationError("WITHDRAWAL_NOT_REQUESTED", "Withdrawal has not been requested.");
    }

    const elapsed = Date.now() - arb.withdrawalRequestedAt;
    if (elapsed < this.config.withdrawalLockDurationMs) {
      const remainingMs = this.config.withdrawalLockDurationMs - elapsed;
      throw new PolicyViolationError(
        "WITHDRAWAL_LOCK_ACTIVE",
        `Withdrawal lock active. Must wait ${remainingMs}ms before withdrawing.`
      );
    }

    const returnedStake = arb.stakedAmount;
    arb.stakedAmount = 0n;
    arb.state = "WITHDRAWN";

    return { returnedStake, arbitrator: arb };
  }

  /**
   * Executes a protocol slash against an arbitrator for malicious behavior.
   */
  public slashArbitrator(arbitratorId: string, reason: string): { slashedAmount: bigint; arbitrator: StakedArbitrator } {
    const arb = this.getArbitratorOrThrow(arbitratorId);

    if (arb.state === "SLASHED" || arb.state === "WITHDRAWN") {
      throw new PolicyViolationError("ALREADY_SLASHED", `Arbitrator "${arbitratorId}" is already ${arb.state}.`);
    }

    const penaltyBps = BigInt(this.config.slashingPenaltyPercentage);
    const slashedAmount = (arb.stakedAmount * penaltyBps) / 100n;

    arb.stakedAmount -= slashedAmount;
    this.slashedTreasury += slashedAmount;
    arb.state = "SLASHED";
    arb.slashingReason = reason;
    arb.reputationScore = 0;

    return { slashedAmount, arbitrator: arb };
  }

  /**
   * Opens a decentralized dispute assigned to active staked arbitrators.
   */
  public openDispute(params: {
    taskId: string;
    procurementId: string;
    disputedAmount: bigint;
    timeoutDurationMs?: number;
    requiredThreshold?: number;
  }): DecentralizedDispute {
    const activeArbs = Array.from(this.arbitrators.values()).filter((a) => a.state === "ACTIVE");

    if (activeArbs.length < (params.requiredThreshold ?? this.config.defaultThreshold)) {
      throw new PolicyViolationError(
        "INSUFFICIENT_ACTIVE_ARBITRATORS",
        `Insufficient active staked arbitrators (${activeArbs.length}) to satisfy threshold.`
      );
    }

    const disputeId = `disp_dec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const timeoutDuration = params.timeoutDurationMs ?? 3600000;

    const dispute: DecentralizedDispute = {
      disputeId,
      taskId: params.taskId,
      procurementId: params.procurementId,
      disputedAmount: params.disputedAmount,
      requiredThreshold: params.requiredThreshold ?? this.config.defaultThreshold,
      timeoutTimestamp: Date.now() + timeoutDuration,
      eligibleArbitratorIds: activeArbs.map((a) => a.arbitratorId),
      status: "PENDING_ARBITRATION",
      votes: new Map(),
    };

    this.disputes.set(disputeId, dispute);
    return dispute;
  }

  /**
   * Casts a signed vote. Detects conflicting votes and triggers immediate slashing.
   */
  public castVote(
    disputeId: string,
    arbitratorId: string,
    verdict: DecentralizedVerdict,
    rationale: string,
    expectedPreviousVerdict?: DecentralizedVerdict
  ): { resolved: boolean; status: DisputeResolutionState; dispute: DecentralizedDispute } {
    const dispute = this.disputes.get(disputeId);
    if (!dispute) {
      throw new PolicyViolationError("DISPUTE_NOT_FOUND", `Dispute "${disputeId}" not found.`);
    }

    if (dispute.status !== "PENDING_ARBITRATION") {
      throw new PolicyViolationError("DISPUTE_ALREADY_RESOLVED", `Dispute is already resolved (${dispute.status}).`);
    }

    if (Date.now() > dispute.timeoutTimestamp) {
      dispute.status = "TIMED_OUT_REFUND";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = "Voting period expired without reaching quorum. Escrow refunded to creator.";
      return { resolved: true, status: dispute.status, dispute };
    }

    const arb = this.getArbitratorOrThrow(arbitratorId);
    if (arb.state !== "ACTIVE") {
      throw new PolicyViolationError("INELIGIBLE_ARBITRATOR", `Arbitrator must be ACTIVE to vote (currently ${arb.state}).`);
    }

    if (!dispute.eligibleArbitratorIds.includes(arbitratorId)) {
      throw new PolicyViolationError("UNAUTHORIZED_ARBITRATOR", `Arbitrator is not assigned to this dispute.`);
    }

    // Double-voting check: If an arbitrator attempts to submit conflicting votes, trigger immediate slashing
    if (dispute.votes.has(arbitratorId)) {
      const existingVote = dispute.votes.get(arbitratorId)!;
      if (existingVote.verdict !== verdict) {
        this.slashArbitrator(
          arbitratorId,
          `Protocol Violation: Submitted contradictory votes ("${existingVote.verdict}" vs "${verdict}") on dispute "${disputeId}".`
        );
        throw new PolicyViolationError(
          "CONTRADICTORY_VOTE_SLASHED",
          `Arbitrator "${arbitratorId}" was slashed for submitting conflicting votes.`
        );
      }
      throw new PolicyViolationError("DUPLICATE_VOTE", `Arbitrator has already cast this vote.`);
    }

    const signature = "0xdecarbsig_" + sha256Hex(`${disputeId}:${arbitratorId}:${verdict}:${rationale}`);

    const vote: DecentralizedVote = {
      arbitratorId,
      verdict,
      rationale,
      signature,
      votedAt: Date.now(),
    };

    dispute.votes.set(arbitratorId, vote);

    // Tally consensus
    const votesList = Array.from(dispute.votes.values());
    const upholdCount = votesList.filter((v) => v.verdict === "UPHOLD_SETTLEMENT").length;
    const refundCount = votesList.filter((v) => v.verdict === "REFUND_CREATOR").length;
    const splitCount = votesList.filter((v) => v.verdict === "SPLIT_PENALTY").length;

    const threshold = dispute.requiredThreshold;

    if (upholdCount >= threshold) {
      dispute.status = "RESOLVED_SETTLE";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Threshold met (${upholdCount}/${threshold}): Payout settled to provider.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    if (refundCount >= threshold) {
      dispute.status = "RESOLVED_REFUND";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Threshold met (${refundCount}/${threshold}): Funds refunded to task creator.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    if (splitCount >= threshold) {
      dispute.status = "RESOLVED_SPLIT";
      dispute.resolvedAt = Date.now();
      dispute.resolutionSummary = `Threshold met (${splitCount}/${threshold}): Split penalty resolved.`;
      return { resolved: true, status: dispute.status, dispute };
    }

    return { resolved: false, status: dispute.status, dispute };
  }

  public getArbitrator(arbitratorId: string): StakedArbitrator | undefined {
    return this.arbitrators.get(arbitratorId);
  }

  public getDispute(disputeId: string): DecentralizedDispute | undefined {
    return this.disputes.get(disputeId);
  }

  public getSlashedTreasury(): bigint {
    return this.slashedTreasury;
  }

  private getArbitratorOrThrow(arbitratorId: string): StakedArbitrator {
    const arb = this.arbitrators.get(arbitratorId);
    if (!arb) {
      throw new PolicyViolationError("ARBITRATOR_NOT_FOUND", `Arbitrator "${arbitratorId}" does not exist.`);
    }
    return arb;
  }
}
