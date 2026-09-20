import { describe, it, expect, beforeEach } from "vitest";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { TaskEscrowSimulator } from "./task-escrow-simulator.js";
import { randomBytes } from "./utils.js";
import {
  TaskState,
  SettlementState,
} from "../managed/task_escrow/contract/index.js";

// Ensure undeployed network ID is set for local simulated execution
setNetworkId("undeployed");

describe("TaskEscrow Smart Contract (Compact)", () => {
  let creatorKey: Uint8Array;
  let agentKey: Uint8Array;
  let rogueKey: Uint8Array;
  let taskId: Uint8Array;
  let conditionHash: Uint8Array;
  let completionHash: Uint8Array;
  const maxBudget = 1000n;

  beforeEach(() => {
    creatorKey = randomBytes(32);
    agentKey = randomBytes(32);
    rogueKey = randomBytes(32);
    taskId = randomBytes(32);
    conditionHash = randomBytes(32);
    completionHash = randomBytes(32);
  });

  describe("Initialization", () => {
    it("initializes ledger state correctly and deterministically", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      const ledger = sim.getLedger();

      expect(ledger.taskState).toBe(TaskState.UNINITIALIZED);
      expect(ledger.settlementState).toBe(SettlementState.UNSETTLED);
      expect(ledger.maxBudget).toBe(0n);
      expect(ledger.escrowedAmount).toBe(0n);
      expect(ledger.sequence).toBe(1n);
      expect(ledger.taskId).toEqual(new Uint8Array(32));
      expect(ledger.creatorCommitment).toEqual(new Uint8Array(32));
      expect(ledger.agentCommitment).toEqual(new Uint8Array(32));
    });
  });

  describe("Task Creation", () => {
    it("allows creator to initialize a task with bounded budget and agent commitment", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      const agentCommitment = sim.computeCommitment(agentKey);

      const ledger = sim.createTask(
        taskId,
        agentCommitment,
        maxBudget,
        conditionHash,
      );

      expect(ledger.taskState).toBe(TaskState.CREATED);
      expect(ledger.taskId).toEqual(taskId);
      expect(ledger.maxBudget).toBe(maxBudget);
      expect(ledger.escrowedAmount).toBe(0n);
      expect(ledger.agentCommitment).toEqual(agentCommitment);
      expect(ledger.creatorCommitment).toEqual(sim.computeCommitment(creatorKey));
      expect(ledger.conditionHash).toEqual(conditionHash);
    });

    it("prevents re-initializing an already created task", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      const agentCommitment = sim.computeCommitment(agentKey);
      sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);

      expect(() => {
        sim.createTask(taskId, agentCommitment, maxBudget, conditionHash);
      }).toThrow("Task is already initialized");
    });

    it("rejects task creation with zero max budget", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      const agentCommitment = sim.computeCommitment(agentKey);

      expect(() => {
        sim.createTask(taskId, agentCommitment, 0n, conditionHash);
      }).toThrow("Max budget must be greater than zero");
    });
  });

  describe("Task Funding", () => {
    it("allows creator to fund task within the configured budget", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      const ledger = sim.fundTask(500n);
      expect(ledger.taskState).toBe(TaskState.FUNDED);
      expect(ledger.escrowedAmount).toBe(500n);
    });

    it("allows incremental funding up to the maximum budget", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      sim.fundTask(400n);
      const ledger = sim.fundTask(600n);
      expect(ledger.taskState).toBe(TaskState.FUNDED);
      expect(ledger.escrowedAmount).toBe(1000n);
    });

    it("prevents funding exceeding the maximum budget", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      expect(() => {
        sim.fundTask(1001n);
      }).toThrow("Escrowed amount cannot exceed maximum budget");
    });

    it("prevents non-creator from funding task", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      // Switch caller to rogue party
      sim.setCallerKeys(rogueKey, agentKey);

      expect(() => {
        sim.fundTask(500n);
      }).toThrow("Only task creator can fund task");
    });

    it("prevents funding with zero deposit amount", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      expect(() => {
        sim.fundTask(0n);
      }).toThrow("Deposit amount must be greater than zero");
    });
  });

  describe("Agent Acceptance & Execution", () => {
    it("allows authorized agent to accept funded task", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);

      const ledger = sim.acceptTask();
      expect(ledger.taskState).toBe(TaskState.ACTIVE);
    });

    it("prevents unauthorized party from accepting task", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);

      // Rogue party attempts to accept
      sim.setCallerKeys(creatorKey, rogueKey);
      expect(() => {
        sim.acceptTask();
      }).toThrow("Only authorized agent can accept task");
    });

    it("prevents accepting a task before it is funded", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);

      expect(() => {
        sim.acceptTask();
      }).toThrow("Task must be FUNDED before it can be activated");
    });

    it("allows authorized agent to submit completion evidence", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);
      sim.acceptTask();

      const ledger = sim.submitCompletion(completionHash);
      expect(ledger.taskState).toBe(TaskState.COMPLETION_PENDING);
      expect(ledger.completionHash).toEqual(completionHash);
    });

    it("prevents unauthorized party from submitting completion", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);
      sim.acceptTask();

      sim.setCallerKeys(creatorKey, rogueKey);
      expect(() => {
        sim.submitCompletion(completionHash);
      }).toThrow("Only authorized agent can submit completion");
    });
  });

  describe("Settlement & Payouts", () => {
    it("executes full happy path lifecycle to COMPLETED and SETTLED_SUCCESS", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(750n);
      sim.acceptTask();
      sim.submitCompletion(completionHash);

      const ledger = sim.settleTask(750n);
      expect(ledger.taskState).toBe(TaskState.COMPLETED);
      expect(ledger.settlementState).toBe(SettlementState.SETTLED_SUCCESS);
      expect(ledger.escrowedAmount).toBe(750n);
    });

    it("prevents double settlement", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(750n);
      sim.acceptTask();
      sim.submitCompletion(completionHash);
      sim.settleTask(750n);

      expect(() => {
        sim.settleTask(750n);
      }).toThrow("Task must be in COMPLETION_PENDING to settle");
    });

    it("prevents payout exceeding escrowed funds", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);
      sim.acceptTask();
      sim.submitCompletion(completionHash);

      expect(() => {
        sim.settleTask(600n);
      }).toThrow("Payout cannot exceed escrowed funds");
    });

    it("prevents non-creator from settling payment", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);
      sim.acceptTask();
      sim.submitCompletion(completionHash);

      sim.setCallerKeys(rogueKey, agentKey);
      expect(() => {
        sim.settleTask(500n);
      }).toThrow("Only task creator can settle payment");
    });
  });

  describe("Refunds & Cancellations", () => {
    it("allows creator to claim refund from FUNDED state", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);

      const ledger = sim.refundTask();
      expect(ledger.taskState).toBe(TaskState.REFUNDED);
      expect(ledger.settlementState).toBe(SettlementState.SETTLED_REFUND);
    });

    it("prevents non-creator from claiming refund", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);

      sim.setCallerKeys(rogueKey, agentKey);
      expect(() => {
        sim.refundTask();
      }).toThrow("Only task creator can claim refund");
    });

    it("prevents refunding an already completed task", () => {
      const sim = new TaskEscrowSimulator(creatorKey, agentKey);
      sim.createTask(taskId, sim.computeCommitment(agentKey), maxBudget, conditionHash);
      sim.fundTask(500n);
      sim.acceptTask();
      sim.submitCompletion(completionHash);
      sim.settleTask(500n);

      expect(() => {
        sim.refundTask();
      }).toThrow("Task cannot be refunded in completed or already refunded state");
    });
  });
});
