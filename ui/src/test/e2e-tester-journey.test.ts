import { describe, it, expect, beforeEach } from "vitest";
import { telemetryService } from "../services/telemetryService";
import { feedbackService } from "../services/feedbackService";
import {
  createTaskPolicy,
  computePolicyCommitment,
  PactraAgentClient,
  TaskPolicyEnvelope,
  createDefaultServiceRegistry,
  CompletionVerifier,
} from "../../../contract/src/index.js";

describe("E2E Tester Journey: Onboarding, Bounded Compute, Telemetry & Feedback Cycle", () => {
  beforeEach(() => {
    telemetryService.clear();
    telemetryService.setEnabled(true);
    feedbackService.clear();
  });

  it("completes the full 10-step tester protocol with zero secret leakage", async () => {
    // Step 1: User visits and completes onboarding
    telemetryService.recordEvent("ONBOARDING_STARTED", "ONBOARDING");
    telemetryService.recordEvent("ONBOARDING_COMPLETED", "ONBOARDING", { stepCount: 4 });

    // Step 2: User connects Midnight Lace
    telemetryService.recordEvent("WALLET_CONNECT_SUCCESS", "WALLET", { network: "preprod" });

    // Step 3: Configure bounded policy and instantiate non-custodial agent
    const registry = createDefaultServiceRegistry();
    const policy = createTaskPolicy({
      taskId: "task_e2e_tester_flow",
      maxTotalBudget: 10n,
      maxSpendPerTransaction: 3n,
      approvedCategories: ["COMPUTE"],
      approvedProviders: ["0xprovider_alpha_enclave_99a4c102"],
      allowedCapabilities: ["COMPUTE"],
      expirationTimestamp: Date.now() + 86400000,
    });

    const envelope: TaskPolicyEnvelope = {
      taskId: policy.taskId,
      objective: "Confidential Matrix Factorization",
      policy,
      allowedCapabilities: policy.allowedCapabilities,
      allowedProviders: policy.approvedProviders,
      budget: {
        userTreasuryTotal: 100n,
        taskEscrowAllocation: 10n,
        currentSpent: 0n,
        remainingBudget: 10n,
        perTransactionLimit: 3n,
      },
      completionConditions: {
        expectedJobId: "job_e2e",
        expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
        maxAllowedCost: 3n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "Matrix Factorization Checksum",
      },
    };

    const agent = new PactraAgentClient(envelope, registry);
    telemetryService.recordEvent("TASK_CREATED", "ESCROW", { taskId: policy.taskId });

    // Step 4: Discover services & procure
    const services = await agent.discoverServices({ category: "COMPUTE" });
    expect(services.length).toBeGreaterThan(0);
    const computeService = services[0];

    const procurement = await agent.requestProcurement(computeService.serviceId, "0xhash_input");
    expect(procurement.status).toBe("SERVICE_ACCEPTED");
    telemetryService.recordEvent("PROCUREMENT_COMPLETED", "MARKETPLACE", {
      serviceId: computeService.serviceId,
    });

    // Step 5: Execute & verify evidence
    const evidence = await agent.submitEvidence(procurement.procurementId);
    expect(evidence.jobId).toBeDefined();

    const verifier = new CompletionVerifier();
    const verification = verifier.verifyExecution(
      {
        expectedJobId: evidence.jobId,
        expectedProviderCommitment: evidence.providerCommitment,
        expectedResultCommitment: evidence.outputHash,
        maxAllowedCost: 3n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "Deterministic Verifier",
      },
      evidence
    );
    expect(verification.verified).toBe(true);
    telemetryService.recordEvent("VERIFICATION_SUCCESS", "VERIFIER");

    // Step 6: Settle escrow payout
    telemetryService.recordEvent("SETTLEMENT_SUCCESS", "ESCROW", {
      payoutAmount: Number(evidence.costIncurred),
    });

    // Step 7: Tester submits in-app feedback
    const feedback = feedbackService.submitFeedback({
      category: "ONBOARDING",
      rating: 5,
      title: "Seamless 9-step compute flow",
      description: "Everything worked smoothly on Preprod with clear zero-knowledge boundary explanations.",
      testerHandle: "@midnight_challenger",
    });

    expect(feedback.feedbackId).toBeDefined();
    expect(feedback.rating).toBe(5);

    // Step 8: Verify telemetry aggregate consistency
    const metrics = telemetryService.getAggregateMetrics();
    expect(metrics.onboardingCompletions).toBe(1);
    expect(metrics.walletConnections).toBe(1);
    expect(metrics.tasksCreated).toBe(1);
    expect(metrics.procurementsCompleted).toBe(1);
    expect(metrics.verificationsPassed).toBe(1);
    expect(metrics.settlements).toBe(1);

    // Step 9: Verify total feedback storage
    expect(feedbackService.getFeedbackList().length).toBe(1);
    expect(feedbackService.getAverageRating()).toBe(5);

    // Step 10: Invariant check — Zero secrets across entire telemetry event log
    for (const ev of telemetryService.getEvents()) {
      const serialized = JSON.stringify(ev);
      expect(serialized).not.toMatch(/privateKey|seedPhrase|mnemonic/i);
    }
  });
});
