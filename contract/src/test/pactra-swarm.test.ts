import { describe, it, expect, beforeEach } from "vitest";
import { CapabilityBroker } from "../pactra/runtime/capabilityBroker.js";
import { PactraSwarmCoordinator } from "../pactra/swarm/swarmCoordinator.js";
import { ServiceRegistry } from "../pactra/registry.js";
import { TaskPolicy, TaskPolicyEnvelope, PolicyViolationError } from "../pactra/policy.js";

describe("Pactra Multi-Agent Swarm Economy & Sub-Delegation Trees", () => {
  let registry: ServiceRegistry;
  let policy: TaskPolicy;
  let envelope: TaskPolicyEnvelope;
  let broker: CapabilityBroker;
  let swarm: PactraSwarmCoordinator;

  beforeEach(() => {
    registry = new ServiceRegistry();

    registry.registerService({
      serviceId: "srv_compute_specialist",
      name: "Specialist GPU Node",
      category: "COMPUTE",
      providerPublicKey: "0xprovider_gpu",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 12n },
      sla: { maxLatencyMs: 100, uptimePrc: 99.9, errorRatePrc: 0.1 },
      status: "ACTIVE",
      reputationScore: 97,
      registeredAt: Date.now(),
    });

    registry.registerService({
      serviceId: "srv_storage_specialist",
      name: "Specialist Storage Node",
      category: "STORAGE",
      providerPublicKey: "0xprovider_store",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 6n },
      sla: { maxLatencyMs: 50, uptimePrc: 99.99, errorRatePrc: 0.01 },
      status: "ACTIVE",
      reputationScore: 99,
      registeredAt: Date.now(),
    });

    policy = {
      taskId: "task_swarm_01",
      maxTotalBudget: 40n,
      maxSpendPerTransaction: 15n,
      allowedCapabilities: ["COMPUTE", "STORAGE"],
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: ["srv_compute_specialist", "srv_storage_specialist"],
      expirationTimestamp: Date.now() + 60000,
    };

    envelope = {
      policy,
      completionConditions: {
        conditionHash: "0xswarmcond",
        requiredArtifacts: ["model.onnx"],
        verificationMethod: "EXECUTION_EVIDENCE",
      },
      policyCommitment: "0xswarmcomm",
      issuedAt: Date.now(),
    };

    broker = new CapabilityBroker(envelope, registry);
    swarm = new PactraSwarmCoordinator(broker);
  });

  it("sub-delegates bounded budgets to specialist agents within root policy ceiling", () => {
    const computeSub = swarm.delegateSubTask({
      delegateAgentId: "agent_compute_specialist",
      role: "SPECIALIST_WORKER",
      allowedCapability: "COMPUTE",
      allocatedBudget: 25n,
    });

    const storageSub = swarm.delegateSubTask({
      delegateAgentId: "agent_storage_specialist",
      role: "SPECIALIST_WORKER",
      allowedCapability: "STORAGE",
      allocatedBudget: 15n,
    });

    expect(computeSub.allocatedBudget).toBe(25n);
    expect(storageSub.allocatedBudget).toBe(15n);
    expect(swarm.getTotalAllocatedSubBudget()).toBe(40n); // 25 + 15 = 40 (max budget exactly matched)
  });

  it("rejects sub-delegation that would exceed the root task budget limit", () => {
    swarm.delegateSubTask({
      delegateAgentId: "agent_compute_specialist",
      role: "SPECIALIST_WORKER",
      allowedCapability: "COMPUTE",
      allocatedBudget: 30n,
    });

    // Attempting to sub-delegate 15n more (30 + 15 = 45 > 40) must throw SWARM_BUDGET_OVERALLOCATION
    expect(() => {
      swarm.delegateSubTask({
        delegateAgentId: "agent_storage_specialist",
        role: "SPECIALIST_WORKER",
        allowedCapability: "STORAGE",
        allocatedBudget: 15n,
      });
    }).toThrow(PolicyViolationError);
  });

  it("rejects sub-delegation for unapproved capabilities", () => {
    expect(() => {
      swarm.delegateSubTask({
        delegateAgentId: "agent_deploy_specialist",
        role: "SPECIALIST_WORKER",
        allowedCapability: "DEPLOYMENT" as any,
        allocatedBudget: 10n,
      });
    }).toThrow(PolicyViolationError);
  });

  it("executes valid sub-procurement and updates sub-delegation and root expenditure", () => {
    const computeSub = swarm.delegateSubTask({
      delegateAgentId: "agent_compute_specialist",
      role: "SPECIALIST_WORKER",
      allowedCapability: "COMPUTE",
      allocatedBudget: 20n,
    });

    const result = swarm.executeSubProcurement(
      computeSub.subDelegationId,
      "srv_compute_specialist",
      "0xpayload123"
    );

    expect(result.status).toBe("SUCCESS");
    expect(result.amountSpent).toBe(12n);

    const updatedSub = swarm.getDelegation(computeSub.subDelegationId)!;
    expect(updatedSub.spentBudget).toBe(12n);
  });

  it("rejects sub-procurement that exceeds the individual sub-delegated allowance", () => {
    // Sub-delegation with only 10n allowance
    const computeSub = swarm.delegateSubTask({
      delegateAgentId: "agent_small_compute",
      role: "SPECIALIST_WORKER",
      allowedCapability: "COMPUTE",
      allocatedBudget: 10n,
    });

    // Service costs 12n > 10n allocated
    expect(() => {
      swarm.executeSubProcurement(
        computeSub.subDelegationId,
        "srv_compute_specialist",
        "0xpayload"
      );
    }).toThrow(PolicyViolationError);
  });
});
