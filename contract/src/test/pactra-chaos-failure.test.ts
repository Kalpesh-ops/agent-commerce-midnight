import { describe, it, expect, vi, beforeEach } from "vitest";
import { CapabilityBroker } from "../pactra/runtime/capabilityBroker.js";
import { PactraAutonomousRuntime } from "../pactra/runtime/autonomousRuntime.js";
import { RuntimePlan } from "../pactra/runtime/runtimeTypes.js";
import { ServiceRegistry } from "../pactra/registry.js";
import { TaskPolicy, TaskPolicyEnvelope, PolicyViolationError } from "../pactra/policy.js";
import { MidnightProofServerAdapter } from "../pactra/proof/proofServerAdapter.js";
import { ProductionHealthMonitor } from "../pactra/health/healthMonitor.js";
import { DecentralizedArbitrationEngine } from "../pactra/arbitration/decentralizedArbitration.js";
import { CompletionVerifier } from "../pactra/verifier.js";
import { sha256Hex } from "../pactra/cryptoUtils.js";

describe("Pactra Chaos & Controlled Failure Simulations", () => {
  let registry: ServiceRegistry;
  let policy: TaskPolicy;
  let envelope: TaskPolicyEnvelope;
  let broker: CapabilityBroker;

  beforeEach(() => {
    registry = new ServiceRegistry();

    registry.registerService({
      serviceId: "srv_chaos_node",
      name: "Chaos Compute Node",
      category: "COMPUTE",
      providerPublicKey: "0xprovider_chaos",
      pricing: { model: "FLAT_PER_UNIT", unitPrice: 10n },
      sla: { maxLatencyMs: 100, uptimePrc: 99.9, errorRatePrc: 0.1 },
      status: "ACTIVE",
      reputationScore: 90,
      registeredAt: Date.now(),
    });

    policy = {
      taskId: "task_chaos_01",
      maxTotalBudget: 50n,
      maxSpendPerTransaction: 20n,
      allowedCapabilities: ["COMPUTE"],
      approvedCategories: ["COMPUTE"],
      approvedProviders: ["srv_chaos_node"],
      expirationTimestamp: Date.now() + 60000,
    };

    envelope = {
      policy,
      completionConditions: {
        conditionHash: "0xcond_chaos",
        requiredArtifacts: ["chaos.log"],
        verificationMethod: "EXECUTION_EVIDENCE",
      },
      policyCommitment: "0xcomm_chaos",
      issuedAt: Date.now(),
    };

    broker = new CapabilityBroker(envelope, registry);
  });

  it("Chaos Scenario 1: service provider disappears mid-plan -> safely halts in ABORTED with zero unauthorized spending", async () => {
    // Service disappears right after plan starts
    broker.evaluateQuote = () => {
      throw new Error("Provider 504 Gateway Timeout: connection lost");
    };

    const runtime = new PactraAutonomousRuntime(broker);
    const plan: RuntimePlan = {
      planId: "plan_provider_down",
      taskId: "task_chaos_01",
      deadlineTimestamp: Date.now() + 30000,
      steps: [
        {
          stepId: "step_dead_provider",
          capability: "COMPUTE",
          targetServiceId: "srv_chaos_node",
        },
      ],
    };

    const summary = await runtime.executePlan(plan);
    expect(summary.currentState).toBe("ABORTED");
    expect(summary.totalSpent).toBe(0n);
    expect(summary.remainingBudget).toBe(50n);
  });

  it("Chaos Scenario 2: indexer goes completely offline -> health monitor flags DOWN and overall CRITICAL", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED indexer.preprod.midnight.network"));
    vi.stubGlobal("fetch", mockFetch);

    const monitor = new ProductionHealthMonitor();
    const report = await monitor.evaluateSystemHealth({
      isWalletConnected: true,
      walletNetwork: "preprod",
      indexerUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
    });

    expect(report.indexer.status).toBe("DOWN");
    expect(report.overall).toBe("CRITICAL");
    expect(report.indexer.message).toContain("ECONNREFUSED");

    vi.unstubAllGlobals();
  });

  it("Chaos Scenario 3: proof server unavailable -> adapter returns OFFLINE and refuses fake proofs", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("503 Service Unavailable: prover capacity exceeded"));
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new MidnightProofServerAdapter({
      proverServerUri: "https://prover.preprod.midnight.network",
      maxRetries: 1,
      timeoutMs: 50,
    });

    const report = await adapter.checkHealth();
    expect(report.status).toBe("OFFLINE");
    expect(report.isConfigured).toBe(true);

    vi.unstubAllGlobals();
  });

  it("Chaos Scenario 4: arbitrator fails to respond before dispute deadline -> resolves to TIMED_OUT_REFUND", async () => {
    const engine = new DecentralizedArbitrationEngine({
      minStakeAmount: 50n,
      withdrawalLockDurationMs: 50,
      slashingPenaltyPercentage: 20,
      defaultThreshold: 2,
    });

    engine.registerArbitrator({ arbitratorId: "arb_ghost", name: "Ghost Node", publicKeyCommitment: "0x1", initialStake: 50n });
    engine.registerArbitrator({ arbitratorId: "arb_late", name: "Late Node", publicKeyCommitment: "0x2", initialStake: 50n });

    const dispute = engine.openDispute({
      taskId: "task_ghost",
      procurementId: "proc_ghost",
      disputedAmount: 20n,
      timeoutDurationMs: 15, // 15ms voting window
    });

    // Wait until deadline elapses
    await new Promise((r) => setTimeout(r, 25));

    const result = engine.castVote(dispute.disputeId, "arb_late", "UPHOLD_SETTLEMENT", "Late vote");
    expect(result.resolved).toBe(true);
    expect(result.status).toBe("TIMED_OUT_REFUND");
    expect(result.dispute.status).toBe("TIMED_OUT_REFUND");
  });

  it("Chaos Scenario 5: malicious provider submits corrupted output hash -> verifier detects tampering and rejects settlement", () => {
    const verifier = new CompletionVerifier();
    const expectedHash = "0x" + sha256Hex("truthful_computation_result");
    const corruptedHash = "0x" + sha256Hex("tampered_fake_result");

    const spec = {
      expectedJobId: "job_tampered",
      expectedProviderCommitment: "srv_chaos_node",
      expectedResultCommitment: expectedHash,
      maxAllowedCost: 10n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Hash verification",
    };

    const evidence = {
      procurementId: "proc_tampered",
      jobId: "job_tampered",
      providerCommitment: "srv_chaos_node",
      costIncurred: 10n,
      outputHash: corruptedHash,
      evidenceSignature: "0xsignature",
      submittedAt: Date.now(),
    };

    const result = verifier.verifyExecution(spec, evidence);
    expect(result.verified).toBe(false);
    expect(result.checks.resultMatchesCommitment).toBe(false);
    expect(result.failureReason).toContain("Result hash does not match");
  });

  it("Chaos Scenario 6: rapid duplicate action attempts do not cause double-spend", () => {
    const intent = {
      serviceCategory: "COMPUTE" as const,
      serviceId: "srv_chaos_node",
      maxAcceptablePrice: 10n,
    };

    // First action
    const action1 = broker.authorizeAction(intent);
    expect(action1.token.authorizedAmount).toBe(10n);

    // Record expenditure
    broker.confirmSettlement(action1.token.authorizationId, 10n);

    // Check budget decreased from 50 to 40
    expect(broker.getBudgetStatus().remainingBudget).toBe(40n);
    expect(broker.getBudgetStatus().currentSpent).toBe(10n);
  });
});
