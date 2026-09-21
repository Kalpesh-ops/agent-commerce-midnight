import { describe, it, expect, beforeEach } from "vitest";
import {
  DecentralizedArbitrationEngine,
  StakingProtocolConfig,
} from "../pactra/arbitration/decentralizedArbitration.js";
import { PolicyViolationError } from "../pactra/policy.js";

describe("Pactra Decentralized Arbitration Engine & Economic Staking", () => {
  let engine: DecentralizedArbitrationEngine;
  const config: StakingProtocolConfig = {
    minStakeAmount: 50n,
    withdrawalLockDurationMs: 50, // fast for testing
    slashingPenaltyPercentage: 25, // 25% slash penalty
    defaultThreshold: 2,
  };

  beforeEach(() => {
    engine = new DecentralizedArbitrationEngine(config);
  });

  it("transitions arbitrator between REGISTERED and ACTIVE based on minStakeAmount", () => {
    // Under-staked (30 < 50) -> REGISTERED
    const arb1 = engine.registerArbitrator({
      arbitratorId: "arb_understaked",
      name: "Understaked Node",
      publicKeyCommitment: "0x111",
      initialStake: 30n,
    });
    expect(arb1.state).toBe("REGISTERED");

    // Deposit remaining 20 -> transitions to ACTIVE
    const activated = engine.depositStake("arb_understaked", 20n);
    expect(activated.state).toBe("ACTIVE");
    expect(activated.stakedAmount).toBe(50n);
  });

  it("enforces withdrawal lock delay before stake can be finalized and returned", async () => {
    engine.registerArbitrator({
      arbitratorId: "arb_staked",
      name: "Staked Validator",
      publicKeyCommitment: "0x222",
      initialStake: 100n,
    });

    // Request withdrawal
    const withdrawing = engine.requestWithdrawal("arb_staked");
    expect(withdrawing.state).toBe("WITHDRAWING");

    // Immediate finalize must throw WITHDRAWAL_LOCK_ACTIVE
    expect(() => engine.finalizeWithdrawal("arb_staked")).toThrow(PolicyViolationError);

    // Wait for withdrawalLockDurationMs
    await new Promise((r) => setTimeout(r, 60));

    const { returnedStake, arbitrator } = engine.finalizeWithdrawal("arb_staked");
    expect(returnedStake).toBe(100n);
    expect(arbitrator.state).toBe("WITHDRAWN");
    expect(arbitrator.stakedAmount).toBe(0n);
  });

  it("resolves multi-party dispute using 2-of-3 threshold consensus among active staked arbitrators", () => {
    // Register 3 active arbitrators
    engine.registerArbitrator({ arbitratorId: "arb_1", name: "Node A", publicKeyCommitment: "0x1", initialStake: 50n });
    engine.registerArbitrator({ arbitratorId: "arb_2", name: "Node B", publicKeyCommitment: "0x2", initialStake: 50n });
    engine.registerArbitrator({ arbitratorId: "arb_3", name: "Node C", publicKeyCommitment: "0x3", initialStake: 50n });

    const dispute = engine.openDispute({
      taskId: "task_stake_01",
      procurementId: "proc_stake_01",
      disputedAmount: 40n,
    });

    expect(dispute.status).toBe("PENDING_ARBITRATION");

    // First vote
    const res1 = engine.castVote(dispute.disputeId, "arb_1", "UPHOLD_SETTLEMENT", "Evidence verified valid");
    expect(res1.resolved).toBe(false);
    expect(res1.status).toBe("PENDING_ARBITRATION");

    // Second vote reaches 2-of-3 quorum
    const res2 = engine.castVote(dispute.disputeId, "arb_2", "UPHOLD_SETTLEMENT", "Output matches spec");
    expect(res2.resolved).toBe(true);
    expect(res2.status).toBe("RESOLVED_SETTLE");
    expect(res2.dispute.status).toBe("RESOLVED_SETTLE");
  });

  it("slashes arbitrator when attempting contradictory double-voting on the same dispute", () => {
    engine.registerArbitrator({ arbitratorId: "arb_1", name: "Node A", publicKeyCommitment: "0x1", initialStake: 100n });
    engine.registerArbitrator({ arbitratorId: "arb_2", name: "Node B", publicKeyCommitment: "0x2", initialStake: 100n });

    const dispute = engine.openDispute({
      taskId: "task_double_vote",
      procurementId: "proc_double_vote",
      disputedAmount: 50n,
    });

    // Vote 1: UPHOLD_SETTLEMENT
    engine.castVote(dispute.disputeId, "arb_1", "UPHOLD_SETTLEMENT", "Legit computation");

    // Attempt contradictory vote: REFUND_CREATOR -> triggers slashing!
    expect(() => {
      engine.castVote(dispute.disputeId, "arb_1", "REFUND_CREATOR", "Actually fraud!");
    }).toThrow(PolicyViolationError);

    const slashedArb = engine.getArbitrator("arb_1")!;
    expect(slashedArb.state).toBe("SLASHED");
    expect(slashedArb.stakedAmount).toBe(75n); // 100 - 25% = 75n
    expect(slashedArb.reputationScore).toBe(0);
    expect(slashedArb.slashingReason).toContain("contradictory votes");

    // Slashed funds credited to treasury
    expect(engine.getSlashedTreasury()).toBe(25n);
  });

  it("rejects votes from ineligible or slashed arbitrators", () => {
    engine.registerArbitrator({ arbitratorId: "arb_valid", name: "Valid Node", publicKeyCommitment: "0x1", initialStake: 100n });
    engine.registerArbitrator({ arbitratorId: "arb_slashed", name: "Bad Node", publicKeyCommitment: "0x2", initialStake: 100n });

    const dispute = engine.openDispute({
      taskId: "task_ineligible",
      procurementId: "proc_ineligible",
      disputedAmount: 25n,
    });

    // Slash arb_slashed
    engine.slashArbitrator("arb_slashed", "Collusion with rogue provider");

    // Slashed arbitrator cannot vote
    expect(() => {
      engine.castVote(dispute.disputeId, "arb_slashed", "UPHOLD_SETTLEMENT", "Vote attempt");
    }).toThrow(PolicyViolationError);
  });

  it("handles timeout refund when voting window passes without reaching quorum", async () => {
    engine.registerArbitrator({ arbitratorId: "arb_1", name: "Node A", publicKeyCommitment: "0x1", initialStake: 50n });
    engine.registerArbitrator({ arbitratorId: "arb_2", name: "Node B", publicKeyCommitment: "0x2", initialStake: 50n });

    const dispute = engine.openDispute({
      taskId: "task_timeout",
      procurementId: "proc_timeout",
      disputedAmount: 30n,
      timeoutDurationMs: 20, // 20ms window
    });

    await new Promise((r) => setTimeout(r, 30));

    // Attempting vote after timeout triggers resolution to TIMED_OUT_REFUND
    const result = engine.castVote(dispute.disputeId, "arb_1", "UPHOLD_SETTLEMENT", "Late vote");
    expect(result.resolved).toBe(true);
    expect(result.status).toBe("TIMED_OUT_REFUND");
  });
});
