import { describe, it, expect, beforeEach } from "vitest";
import { CapabilityBroker } from "../pactra/runtime/capabilityBroker.js";
import { PactraAutonomousRuntime } from "../pactra/runtime/autonomousRuntime.js";
import { RuntimePlan } from "../pactra/runtime/runtimeTypes.js";
import { ServiceRegistry, ServiceListing } from "../pactra/registry.js";
import { TaskPolicy, TaskPolicyEnvelope } from "../pactra/policy.js";
import { PolicyViolationError } from "../pactra/policy.js";

describe("Pactra Headless Autonomous Agent Runtime & Capability Broker", () => {
  let registry: ServiceRegistry;
  let policy: TaskPolicy;
  let envelope: TaskPolicyEnvelope;
  let broker: CapabilityBroker;

  beforeEach(() => {
    registry = new ServiceRegistry();

    // Register test services
    const computeService: ServiceListing = {
      serviceId: "srv_compute_test",
      name: "Secure Compute Node",
      category: "COMPUTE",
      providerPublicKey: "0xprovider_compute",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 10n },
      sla: { maxLatencyMs: 500, uptimePrc: 99.9, errorRatePrc: 0.1 },
      status: "ACTIVE",
      reputationScore: 98,
      registeredAt: Date.now(),
    };

    const storageService: ServiceListing = {
      serviceId: "srv_storage_test",
      name: "Encrypted Blob Store",
      category: "STORAGE",
      providerPublicKey: "0xprovider_storage",
      pricing: { model: "TIERED_USAGE", unitPrice: 5n },
      sla: { maxLatencyMs: 200, uptimePrc: 99.99, errorRatePrc: 0.01 },
      status: "ACTIVE",
      reputationScore: 99,
      registeredAt: Date.now(),
    };

    registry.registerService(computeService);
    registry.registerService(storageService);

    policy = {
      taskId: "task_runtime_01",
      maxTotalBudget: 50n,
      maxSpendPerTransaction: 15n,
      allowedCapabilities: ["COMPUTE", "STORAGE"],
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: ["srv_compute_test", "srv_storage_test"],
      expirationTimestamp: Date.now() + 60000,
    };

    envelope = {
      policy,
      completionConditions: {
        conditionHash: "0xcond123",
        requiredArtifacts: ["out.bin"],
        verificationMethod: "EXECUTION_EVIDENCE",
      },
      policyCommitment: "0xcomm123",
      issuedAt: Date.now(),
    };

    broker = new CapabilityBroker(envelope, registry);
  });

  it("executes a complete multi-step autonomous plan successfully to COMPLETED state", async () => {
    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_01",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_01_compute",
          capability: "COMPUTE",
          targetServiceId: "srv_compute_test",
        },
        {
          stepId: "step_02_storage",
          capability: "STORAGE",
          targetServiceId: "srv_storage_test",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);
    expect(summary.currentState).toBe("COMPLETED");
    expect(summary.completedSteps).toBe(2);
    expect(summary.totalSpent).toBe(15n); // 10 + 5
    expect(summary.remainingBudget).toBe(35n); // 50 - 15
    expect(summary.isTerminal).toBe(true);

    const states = summary.transitions.map((t) => t.toState);
    expect(states).toContain("WAITING_FOR_QUOTE");
    expect(states).toContain("WAITING_FOR_AUTHORIZATION");
    expect(states).toContain("PROCUREMENT_PENDING");
    expect(states).toContain("EXECUTING");
    expect(states).toContain("COMPLETED");
  });

  it("enforces capability boundary and halts with ABORTED if unapproved category requested", async () => {
    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_unapproved",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_unapproved_deploy",
          capability: "DEPLOYMENT" as any,
          targetServiceId: "srv_compute_test",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("ABORTED");
    expect(summary.completedSteps).toBe(0);
    expect(summary.totalSpent).toBe(0n);
    expect(summary.isTerminal).toBe(true);
  });

  it("enforces per-transaction spending limit and safely halts without balance drain", async () => {
    // Add expensive service that exceeds maxSpendPerTransaction (20 > 15)
    registry.registerService({
      serviceId: "srv_expensive",
      name: "Supercomputer Enclave",
      category: "COMPUTE",
      providerPublicKey: "0xprovider_expensive",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 25n },
      sla: { maxLatencyMs: 100, uptimePrc: 99.9, errorRatePrc: 0.1 },
      status: "ACTIVE",
      reputationScore: 90,
      registeredAt: Date.now(),
    });

    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_expensive",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_too_expensive",
          capability: "COMPUTE",
          targetServiceId: "srv_expensive",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("ABORTED");
    expect(summary.completedSteps).toBe(0);
    expect(summary.totalSpent).toBe(0n);
  });

  it("detects expired deadline and transitions directly to EXPIRED state", async () => {
    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_expired",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() - 5000, // already in the past
      steps: [
        {
          stepId: "step_compute",
          capability: "COMPUTE",
          targetServiceId: "srv_compute_test",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("EXPIRED");
    expect(summary.completedSteps).toBe(0);
    expect(summary.totalSpent).toBe(0n);
  });

  it("recovers from simulated transient error via RETRYING and succeeds", async () => {
    let callCount = 0;
    // Wrap broker evaluateQuote to fail once transiently
    const originalEvaluate = broker.evaluateQuote.bind(broker);
    broker.evaluateQuote = (serviceId: string) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("Network glitch / temporary provider rate limit");
      }
      return originalEvaluate(serviceId);
    };

    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_retry",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_transient",
          capability: "COMPUTE",
          targetServiceId: "srv_compute_test",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("COMPLETED");
    expect(summary.completedSteps).toBe(1);
    expect(summary.retryCount).toBe(1);
    expect(summary.transitions.some((t) => t.toState === "RETRYING")).toBe(true);
  });

  it("halts with ABORTED when retry ceiling is exhausted", async () => {
    // Force broker to always fail with a transient error
    broker.evaluateQuote = () => {
      throw new Error("Persistent connection drop");
    };

    const runtime = new PactraAutonomousRuntime(broker);

    const plan: RuntimePlan = {
      planId: "plan_retry_exhausted",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_always_fail",
          capability: "COMPUTE",
          targetServiceId: "srv_compute_test",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("ABORTED");
    expect(summary.completedSteps).toBe(0);
    expect(summary.retryCount).toBe(3); // exhausted maxRetries 3
  });

  it("asserts runtime and capability broker reject generic wallet transfer operations", () => {
    // Attempting raw generic transfers must be strictly blocked
    expect(() => {
      (broker as any).authority.assertNoTreasuryAccess("sendTransaction(0x123, 10)");
    }).toThrow(PolicyViolationError);

    expect(() => {
      (broker as any).authority.assertNoTreasuryAccess("drainTreasury");
    }).toThrow(PolicyViolationError);
  });

  it("handles multi-step plan where a subsequent step fails cleanly without corrupting prior state", async () => {
    const runtime = new PactraAutonomousRuntime(broker);

    // Register a failing third service
    registry.registerService({
      serviceId: "srv_failing",
      name: "Flaky Service",
      category: "COMPUTE",
      providerPublicKey: "0xprovider_flaky",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 10n },
      sla: { maxLatencyMs: 100, uptimePrc: 50, errorRatePrc: 50 },
      status: "ACTIVE",
      reputationScore: 40,
      registeredAt: Date.now(),
    });

    const plan: RuntimePlan = {
      planId: "plan_multi_fail",
      taskId: "task_runtime_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_01_ok",
          capability: "COMPUTE",
          targetServiceId: "srv_compute_test",
        },
        {
          stepId: "step_02_fail",
          capability: "COMPUTE",
          targetServiceId: "srv_failing",
        },
      ],
    };

    // Make srv_failing fail in evaluateQuote
    const originalEval = broker.evaluateQuote.bind(broker);
    broker.evaluateQuote = (sId: string) => {
      if (sId === "srv_failing") {
        throw new Error("Provider rejected connection: service down");
      }
      return originalEval(sId);
    };

    const summary = await runtime.executePlan(plan);

    expect(summary.currentState).toBe("ABORTED");
    expect(summary.completedSteps).toBe(1); // First step succeeded
    expect(summary.totalSpent).toBe(10n); // First step paid, second step never charged
  });
});

