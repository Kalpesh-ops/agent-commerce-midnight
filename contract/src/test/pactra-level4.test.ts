import { describe, it, expect, beforeEach } from "vitest";
import {
  createTaskPolicy,
  TaskPolicy,
  createDefaultServiceRegistry,
  ServiceRegistry,
  PactraAgentClient,
  TaskPolicyEnvelope,
  CompletionVerifier,
  PolicyViolationError,
} from "../pactra/index.js";

describe("Pactra Level 4 — PactraAgentClient API & Non-Custodial Boundaries", () => {
  let registry: ServiceRegistry;
  let envelope: TaskPolicyEnvelope;
  let client: PactraAgentClient;

  beforeEach(() => {
    registry = createDefaultServiceRegistry();
    const verifier = new CompletionVerifier();
    const conditionCommitment = verifier.computeConditionCommitment({
      expectedJobId: "job_l4_compute_01",
      expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
      expectedResultCommitment: undefined,
      maxAllowedCost: 3n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Level 4 Test Verifier",
    });

    const policy: TaskPolicy = createTaskPolicy({
      taskId: "task_l4_agent_001",
      maxTotalBudget: 15n,
      maxSpendPerTransaction: 3n,
      approvedCategories: ["COMPUTE", "STORAGE", "API_CALL"],
      approvedProviders: [
        "0xprovider_alpha_enclave_99a4c102",
        "0xprovider_beta_worker_77c2e501",
        "0xprovider_gamma_store_44f1b883",
        "0xprovider_api_gateway_33d8a901",
      ],
      allowedCapabilities: ["COMPUTE", "STORAGE", "API_CALL"],
      expirationTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      completionConditionCommitment: conditionCommitment,
    });

    envelope = {
      taskId: policy.taskId,
      objective: "Train quantized sentiment classifier and persist model artifacts",
      policy,
      allowedCapabilities: policy.allowedCapabilities,
      allowedProviders: policy.approvedProviders,
      budget: {
        userTreasuryTotal: 200n,
        taskEscrowAllocation: 15n,
        currentSpent: 0n,
        reservedBudget: 0n,
        remainingBudget: 15n,
        perTransactionLimit: 3n,
      },
      completionConditions: {
        expectedJobId: "job_l4_compute_01",
        expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
        expectedResultCommitment: undefined,
        maxAllowedCost: 3n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "Level 4 Test Verifier",
      },
    };

    client = new PactraAgentClient(envelope, registry);
  });

  it("initializes with TaskPolicyEnvelope and returns accurate task status", async () => {
    const status = await client.getTaskStatus();
    expect(status.taskId).toBe("task_l4_agent_001");
    expect(status.objective).toContain("sentiment classifier");
    expect(status.remainingBudget).toBe(15n);
    expect(status.totalEscrowAllocation).toBe(15n);
    expect(status.currentSpent).toBe(0n);
    expect(status.activeProcurementsCount).toBe(0);
    expect(status.isExpired).toBe(false);
  });

  it("discovers active services and supports filtering by capability category", async () => {
    const allServices = await client.discoverServices();
    expect(allServices.length).toBeGreaterThanOrEqual(5);

    const computeServices = await client.discoverServices({ category: "COMPUTE" });
    expect(computeServices.length).toBe(2);
    expect(computeServices.every((s) => s.category === "COMPUTE")).toBe(true);

    const cheapServices = await client.discoverServices({ maxUnitPrice: 1n });
    expect(cheapServices.every((s) => s.unitPrice <= 1n)).toBe(true);
  });

  it("provides verified quotes and checks policy budget authorizations", async () => {
    // 1. Approved compute service
    const quote = await client.requestQuote("srv_compute_alpha");
    expect(quote.serviceId).toBe("srv_compute_alpha");
    expect(quote.category).toBe("COMPUTE");
    expect(quote.unitPrice).toBe(2n);
    expect(quote.withinPolicyBudget).toBe(true);
    expect(quote.authorized).toBe(true);

    // 2. Unapproved capability (DEPLOYMENT is not in envelope.allowedCapabilities)
    const deployQuote = await client.requestQuote("srv_deploy_delta");
    expect(deployQuote.authorized).toBe(false);
    expect(deployQuote.reason).toContain("Capability \"DEPLOYMENT\" not approved");
  });

  it("executes service procurement, reserves escrow budget, and tracks status", async () => {
    const record = await client.requestProcurement("srv_compute_alpha", "0xinput_weights_matrix");
    expect(record.status).toBe("SERVICE_ACCEPTED");
    expect(record.authToken).toBeDefined();
    expect(record.authToken?.authorizedAmount).toBe(2n);

    const statusAfter = await client.getTaskStatus();
    expect(statusAfter.remainingBudget).toBe(13n);
    expect(statusAfter.activeProcurementsCount).toBe(1);
  });

  it("submits and receives verifiable execution evidence from provider", async () => {
    const record = await client.requestProcurement("srv_compute_alpha");
    const evidence = await client.submitEvidence(record.procurementId);

    expect(evidence.jobId).toBe(record.jobSpec.jobId);
    expect(evidence.providerCommitment).toBe("0xprovider_alpha_enclave_99a4c102");
    expect(evidence.outputHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(evidence.evidenceSignature).toMatch(/^0xsig_/);
  });

  it("strictly blocks generic treasury access attempts with PolicyViolationError", () => {
    expect(() => client.assertNoTreasuryAccess("sendTransaction")).toThrow(PolicyViolationError);
    expect(() => client.assertNoTreasuryAccess("transfer")).toThrow(PolicyViolationError);
    expect(() => client.assertNoTreasuryAccess("exportKey")).toThrow(PolicyViolationError);
    expect(() => client.assertNoTreasuryAccess("drainTreasury")).toThrow(PolicyViolationError);
  });

  it("rejects procurement when the task policy has expired", async () => {
    const shortLivedPolicy = createTaskPolicy({
      ...envelope.policy,
      expirationTimestamp: Date.now() + 20,
    });
    const expiredEnvelope = { ...envelope, policy: shortLivedPolicy };
    const clientForExpiration = new PactraAgentClient(expiredEnvelope, registry);

    // Wait for policy to expire
    await new Promise((resolve) => setTimeout(resolve, 35));

    await expect(clientForExpiration.requestProcurement("srv_compute_alpha")).rejects.toThrow(
      PolicyViolationError
    );
  });
});
