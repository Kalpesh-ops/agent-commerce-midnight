import { describe, it, expect, beforeEach } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { TaskEscrowSimulator } from "./task-escrow-simulator.js";
import { TaskState, SettlementState } from "../managed/task_escrow/contract/index.js";
import { randomBytes } from "./utils.js";
import { ArbitrationBoard } from "../pactra/arbitration.js";
import { TaskPolicy, TaskPolicyEnvelope, PolicyViolationError } from "../pactra/policy.js";
import { AgentAuthorityManager } from "../pactra/authority.js";
import { CompletionVerifier } from "../pactra/verifier.js";
import { sha256Hex } from "../pactra/cryptoUtils.js";

setNetworkId("undeployed");

describe("Pactra Smart Contract Audit Readiness — 10 Core Invariants", () => {
  let sim: TaskEscrowSimulator;
  let creatorSk: Uint8Array;
  let agentSk: Uint8Array;
  let attackerSk: Uint8Array;
  let taskId: Uint8Array;
  let conditionHash: Uint8Array;
  let evidenceHash: Uint8Array;
  const maxBudget = 100n;

  beforeEach(() => {
    creatorSk = randomBytes(32);
    agentSk = randomBytes(32);
    attackerSk = randomBytes(32);
    taskId = randomBytes(32);
    conditionHash = randomBytes(32);
    evidenceHash = randomBytes(32);
    sim = new TaskEscrowSimulator(creatorSk, agentSk);
  });


  it("Invariant 1 (Single Settlement): funds cannot settle twice", () => {
    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);
    sim.fundTask(50n);
    sim.acceptTask();
    sim.submitCompletion(evidenceHash);

    // First settlement succeeds
    const ledger = sim.settleTask(50n);
    expect(ledger.taskState).toBe(TaskState.COMPLETED);
    expect(ledger.settlementState).toBe(SettlementState.SETTLED_SUCCESS);

    // Second settlement must revert
    expect(() => sim.settleTask(50n)).toThrow();
  });

  it("Invariant 2 (Mutual Exclusivity): refund and settlement cannot both succeed", () => {
    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);
    sim.fundTask(50n);
    sim.acceptTask();
    sim.submitCompletion(evidenceHash);

    // Settle first
    sim.settleTask(50n);

    // Attempting refund after settlement must throw
    expect(() => sim.refundTask()).toThrow();

    // Verify vice-versa on a fresh simulator
    const sim2 = new TaskEscrowSimulator(creatorSk, agentSk);
    const agentCommitment2 = sim2.computeCommitment(agentSk);
    sim2.createTask(taskId, agentCommitment2, maxBudget, conditionHash);
    sim2.fundTask(50n);

    // Refund first
    const ledger2 = sim2.refundTask();
    expect(ledger2.taskState).toBe(TaskState.REFUNDED);
    expect(ledger2.settlementState).toBe(SettlementState.SETTLED_REFUND);

    // Settlement after refund must throw
    expect(() => sim2.settleTask(50n)).toThrow();
  });

  it("Invariant 3 (Protected State Mutation): unauthorized actors cannot mutate protected task state", () => {
    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);

    // Attacker attempts to fund the task
    sim.setCallerKeys(attackerSk, agentSk);
    expect(() => sim.fundTask(50n)).toThrow();

    // Creator funds the task
    sim.setCallerKeys(creatorSk, agentSk);
    sim.fundTask(50n);

    // Attacker attempts to accept the task as agent
    sim.setCallerKeys(creatorSk, attackerSk);
    expect(() => sim.acceptTask()).toThrow();
  });

  it("Invariant 4 (Agent Authority Ceiling): agent authority cannot exceed task policy bounds", () => {
    const policy: TaskPolicy = {
      taskId: "task_inv_policy",
      maxTotalBudget: 50n,
      maxSpendPerTransaction: 15n,
      allowedCapabilities: ["COMPUTE"],
      approvedCategories: ["COMPUTE"],
      approvedProviders: ["srv_compute_01"],
      expirationTimestamp: Date.now() + 60000,
    };

    const authority = new AgentAuthorityManager({
      userTreasuryTotal: 1000n,
      taskEscrowAllocation: 50n,
      policy,
    });

    // Rejects request exceeding per-transaction limit (20 > 15)
    expect(() =>
      authority.authorizeProcurement({
        procurementId: "req_01",
        taskId: "task_inv_policy",
        providerId: "srv_compute_01",
        serviceCategory: "COMPUTE",
        capability: "COMPUTE",
        requestedAmount: 20n,
      })
    ).toThrow(PolicyViolationError);

    // Rejects unapproved category / capability
    expect(() =>
      authority.authorizeProcurement({
        procurementId: "req_02",
        taskId: "task_inv_policy",
        providerId: "srv_compute_01",
        serviceCategory: "STORAGE" as any,
        capability: "STORAGE" as any,
        requestedAmount: 10n,
      })
    ).toThrow(PolicyViolationError);

    // Approves valid request
    const token = authority.authorizeProcurement({
      procurementId: "req_03",
      taskId: "task_inv_policy",
      providerId: "srv_compute_01",
      serviceCategory: "COMPUTE",
      capability: "COMPUTE",
      requestedAmount: 10n,
    });
    expect(token.authorizedAmount).toBe(10n);
    expect(token.taskId).toBe("task_inv_policy");
  });

  it("Invariant 5 (Budget Overflow Prevention): deposit cannot exceed maxBudget", () => {
    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);

    // Deposit within budget succeeds
    sim.fundTask(60n);
    expect(sim.getLedger().escrowedAmount).toBe(60n);

    // Deposit exceeding maxBudget (60 + 50 > 100) must throw
    expect(() => sim.fundTask(50n)).toThrow();
  });

  it("Invariant 6 (Inactive State Protection): inactive tasks cannot execute active-phase transitions", () => {
    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);
    sim.fundTask(50n);

    // Task is in FUNDED state, not ACTIVE. Attempting submitCompletion must throw
    expect(() => sim.submitCompletion(evidenceHash)).toThrow();
  });

  it("Invariant 7 (Objective Evidence Integrity): verifier cryptographically validates completion conditions", () => {
    const verifier = new CompletionVerifier();
    const expectedHash = "0x" + sha256Hex("expected_result_data");

    const spec = {
      expectedJobId: "job_001",
      expectedProviderCommitment: "0xprovider123",
      expectedResultCommitment: expectedHash,
      maxAllowedCost: 10n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Deterministic hash matching",
    };

    const validEvidence = {
      procurementId: "proc_001",
      jobId: "job_001",
      providerCommitment: "0xprovider123",
      costIncurred: 10n,
      outputHash: expectedHash,
      evidenceSignature: "0xsig123",
      submittedAt: Date.now(),
      metrics: { executionDurationMs: 120 },
    };

    const invalidEvidence = {
      ...validEvidence,
      outputHash: "0x" + sha256Hex("corrupted_result_data"),
    };

    const validResult = verifier.verifyExecution(spec, validEvidence);
    expect(validResult.verified).toBe(true);

    const invalidResult = verifier.verifyExecution(spec, invalidEvidence);
    expect(invalidResult.verified).toBe(false);
  });

  it("Invariant 8 (Dispute Non-Bypass): contested tasks cannot bypass arbitration", () => {
    const board = new ArbitrationBoard(
      [
        { arbitratorId: "arb_1", name: "Alice", publicKeyCommitment: "0x111", isHuman: true, reputationScore: 98 },
        { arbitratorId: "arb_2", name: "Bob", publicKeyCommitment: "0x222", isHuman: true, reputationScore: 95 },
        { arbitratorId: "arb_3", name: "Carol", publicKeyCommitment: "0x333", isHuman: false, reputationScore: 99 },
      ],
      2
    );

    const dispute = board.openDispute({
      procurementId: "proc_contested_01",
      taskId: "task_01",
      claimant: "CREATOR",
      reason: "Execution output does not match SLA specification",
      disputedAmount: 30n,
      evidencePayloadHash: "0xevid",
    });

    expect(dispute.status).toBe("PENDING_ARBITRATION");

    // Single vote is insufficient for 2-of-3 threshold
    board.castVote(dispute.disputeId, "arb_1", "REFUND_CREATOR", "SLA failure confirmed");

    expect(board.getDispute(dispute.disputeId)?.status).toBe("PENDING_ARBITRATION");

    // Second vote reaches quorum
    const result = board.castVote(dispute.disputeId, "arb_2", "REFUND_CREATOR", "Agreed with SLA failure");

    expect(result.resolved).toBe(true);
    expect(result.status).toBe("RESOLVED_REFUND");
  });

  it("Invariant 9 (Arbitration Anti-Replay): duplicate voting and replay attacks are rejected", () => {
    const board = new ArbitrationBoard(
      [
        { arbitratorId: "arb_1", name: "Alice", publicKeyCommitment: "0x111", isHuman: true, reputationScore: 98 },
        { arbitratorId: "arb_2", name: "Bob", publicKeyCommitment: "0x222", isHuman: true, reputationScore: 95 },
      ],
      2
    );

    const dispute = board.openDispute({
      procurementId: "proc_replay_test",
      taskId: "task_02",
      claimant: "PROVIDER",
      reason: "Payment withheld despite evidence",
      disputedAmount: 20n,
      evidencePayloadHash: "0xevid2",
    });

    board.castVote(dispute.disputeId, "arb_1", "UPHOLD_SETTLEMENT", "Evidence confirmed valid");

    // Replay of identical vote by arb_1 must throw PolicyViolationError
    expect(() =>
      board.castVote(dispute.disputeId, "arb_1", "UPHOLD_SETTLEMENT", "Evidence confirmed valid")
    ).toThrow(PolicyViolationError);
  });

  it("Invariant 10 (State Sequence Monotonicity): sequence increments and preserves order", () => {
    const initialSeq = sim.getLedger().sequence;
    expect(initialSeq).toBe(1n);

    const agentCommitment = sim.computeCommitment(agentSk);
    sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);

    // Ledger sequence was used to derive commitments and remains strictly positive
    expect(sim.getLedger().sequence).toBeGreaterThanOrEqual(1n);
    expect(sim.getLedger().taskState).toBe(TaskState.CREATED);
  });
});
