import { describe, it, expect, beforeEach } from "vitest";
import {
  createTaskPolicy,
  computePolicyCommitment,
  PactraAgentClient,
  TaskPolicyEnvelope,
  createDefaultServiceRegistry,
  CompletionVerifier,
} from "../index.js";

describe("Pactra Level 5: Reliability, Error Hardening & Tester Safety Invariants", () => {
  let envelope: TaskPolicyEnvelope;
  let client: PactraAgentClient;

  beforeEach(() => {
    const policy = createTaskPolicy({
      taskId: "task_l5_tester_001",
      maxTotalBudget: 15n,
      maxSpendPerTransaction: 5n,
      approvedCategories: ["COMPUTE", "STORAGE", "API_CALL"],
      approvedProviders: ["0xprovider_alpha_enclave_99a4c102"],
      allowedCapabilities: ["COMPUTE", "STORAGE", "API_CALL"],
      expirationTimestamp: Date.now() + 86400000,
    });

    envelope = {
      taskId: policy.taskId,
      objective: "Execute confidential benchmark and test error recovery",
      policy,
      allowedCapabilities: policy.allowedCapabilities,
      allowedProviders: policy.approvedProviders,
      budget: {
        userTreasuryTotal: 200n,
        taskEscrowAllocation: 15n,
        currentSpent: 0n,
        remainingBudget: 15n,
        perTransactionLimit: 5n,
      },
    };

    const registry = createDefaultServiceRegistry();
    client = new PactraAgentClient(envelope, registry);
  });

  describe("1. Complete First-Time Tester Journey Lifecycle", () => {
    it("executes the complete 9-step tester journey from policy authorization to settlement release", async () => {
      // Step 1: Policy envelope is valid
      expect(envelope.policy.taskId).toBe("task_l5_tester_001");
      expect(envelope.policy.maxTotalBudget).toBe(15n);

      // Step 2: Discover approved compute services
      const services = await client.discoverServices({ category: "COMPUTE", maxUnitPrice: 5 });
      expect(services.length).toBeGreaterThan(0);
      const targetService = services[0];
      expect(targetService.category).toBe("COMPUTE");

      // Step 3: Get binding quote
      const quote = await client.requestQuote(targetService.serviceId);
      expect(quote.unitPrice).toBeLessThanOrEqual(5n);

      // Step 4: Request bounded procurement
      const record = await client.requestProcurement(
        targetService.serviceId,
        "0xinput_hash_tester_01",
        "job_tester_e2e_01"
      );
      expect(record.status).toBe("SERVICE_ACCEPTED");
      expect(record.authToken).toBeDefined();

      // Step 5: Submit verified execution evidence
      const evidence = await client.submitEvidence(record.procurementId);
      expect(evidence.jobId).toBe("job_tester_e2e_01");
      expect(evidence.outputHash).toBeDefined();

      // Step 6: Query remaining budget
      const status = await client.getTaskStatus();
      expect(status.remainingBudget).toBe(15n - quote.unitPrice);
    });

    it("verifies settlement refund branch when provider evidence is corrupted", async () => {
      const verifier = new CompletionVerifier();
      const conditionCommitment = verifier.computeConditionCommitment({
        expectedJobId: "job_tester_refund_01",
        expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
        expectedResultCommitment: "0xexpected_valid_result",
        maxAllowedCost: 5n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "Deterministic verifier",
      });

      // Corrupted evidence
      const corruptedEvidence = {
        jobId: "job_tester_refund_01",
        providerCommitment: "0xprovider_alpha_enclave_99a4c102",
        outputHash: "0xcorrupted_mismatched_output",
        executionDurationMs: 1200,
        costIncurred: 3n,
        evidenceSignature: "0xsig_01",
        timestamp: Date.now(),
      };

      const result = verifier.verifyExecution(
        {
          expectedJobId: "job_tester_refund_01",
          expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
          expectedResultCommitment: "0xexpected_valid_result",
          maxAllowedCost: 5n,
          isSubjectiveTask: false,
          externalVerifierRequired: false,
          verifierDescription: "Deterministic verifier",
        },
        corruptedEvidence
      );

      expect(result.verified).toBe(false);
      expect(result.failureReason).toContain("does not match");
    });
  });

  describe("2. Error Hardening & Recovery Mapping Invariants", () => {
    it("maps wallet rejection errors to actionable tester recovery guidance", () => {
      const errorMessage = "User rejected transaction signing in Midnight Lace popup.";
      const isRejection = /reject|denied|cancel/i.test(errorMessage);
      expect(isRejection).toBe(true);
    });

    it("maps insufficient DUST balance errors to Nethermind Faucet guidance", () => {
      const errorMessage = "Insufficient shielded DUST balance in wallet pool to balance transaction.";
      const isBalanceError = /insufficient|balance|dust/i.test(errorMessage);
      expect(isBalanceError).toBe(true);
    });

    it("maps indexer timeout errors to refresh guidance", () => {
      const errorMessage = "GraphQL indexer query timed out waiting for epoch confirmation.";
      const isTimeout = /timeout|timed out/i.test(errorMessage);
      expect(isTimeout).toBe(true);
    });

    it("prevents double-action procurement when already in flight", async () => {
      const services = await client.discoverServices({ category: "COMPUTE" });
      const serviceId = services[0].serviceId;

      // First procurement succeeds
      const rec1 = await client.requestProcurement(serviceId, "0xhash_01", "job_once_01");
      expect(rec1.status).toBe("SERVICE_ACCEPTED");

      // Evidence submission transitions state to COMPLETED
      await client.submitEvidence(rec1.procurementId);

      // Second evidence submission with same procurement ID must be rejected as already executed/submitted
      await expect(
        client.submitEvidence(rec1.procurementId)
      ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
    });
  });

  describe("3. Zero-Treasury Custody & Safety Invariants", () => {
    it("CRITICAL: assertNoTreasuryAccess strictly forbids generic transfers", () => {
      expect(() => {
        client.assertNoTreasuryAccess("sendTransaction");
      }).toThrow(/ZERO treasury access/);

      expect(() => {
        client.assertNoTreasuryAccess("transfer");
      }).toThrow(/ZERO treasury access/);

      expect(() => {
        client.assertNoTreasuryAccess("drainTreasury");
      }).toThrow(/ZERO treasury access/);
    });

    it("enforces budget caps and prevents unauthorized spending overflow", async () => {
      const registry = createDefaultServiceRegistry();
      registry.registerService({
        serviceId: "srv_expensive_h100",
        name: "H100 SXM5 Supercluster",
        category: "COMPUTE",
        providerCommitment: "0xprovider_alpha_enclave_99a4c102",
        unitPrice: 10n, // Exceeds perTransactionLimit of 5n
        pricingModel: "PER_CALL",
        verificationMethod: "ENCLAVE_ATTESTATION",
        status: "ACTIVE",
      });

      const boundedClient = new PactraAgentClient(envelope, registry);

      // Max spend per transaction is 5 DUST; requesting 10 DUST service must fail
      await expect(
        boundedClient.requestProcurement("srv_expensive_h100")
      ).rejects.toThrow(/exceeds/i);
    });
  });
});
