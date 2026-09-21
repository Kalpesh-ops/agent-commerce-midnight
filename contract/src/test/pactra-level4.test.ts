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
  PactraMcpAdapter,
  PACTRA_MCP_TOOLS,
  sha256Hex,
  createOnChainPolicyBinding,
  validatePolicyAgainstOnChainBinding,
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
      taskId: envelope.policy.taskId,
      maxTotalBudget: envelope.policy.maxTotalBudget,
      maxSpendPerTransaction: envelope.policy.maxSpendPerTransaction,
      approvedCategories: [...envelope.policy.approvedCategories],
      approvedProviders: [...envelope.policy.approvedProviders],
      allowedCapabilities: [...envelope.policy.allowedCapabilities],
      expirationTimestamp: Date.now() + 20,
      completionConditionCommitment: envelope.policy.completionConditionCommitment,
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

describe("Pactra Level 4 — Model Context Protocol (MCP) Adapter & Tools", () => {
  let registry: ServiceRegistry;
  let envelope: TaskPolicyEnvelope;
  let client: PactraAgentClient;
  let mcp: PactraMcpAdapter;

  beforeEach(() => {
    registry = createDefaultServiceRegistry();
    const verifier = new CompletionVerifier();
    const conditionCommitment = verifier.computeConditionCommitment({
      expectedJobId: "job_mcp_001",
      expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
      maxAllowedCost: 3n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "MCP Test Verifier",
    });

    const policy = createTaskPolicy({
      taskId: "task_mcp_001",
      maxTotalBudget: 10n,
      maxSpendPerTransaction: 3n,
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: [
        "0xprovider_alpha_enclave_99a4c102",
        "0xprovider_gamma_store_44f1b883",
      ],
      allowedCapabilities: ["COMPUTE", "STORAGE"],
      expirationTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      completionConditionCommitment: conditionCommitment,
    });

    envelope = {
      taskId: policy.taskId,
      objective: "Train neural ranker via sandboxed compute",
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
        expectedJobId: "job_mcp_001",
        expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
        maxAllowedCost: 3n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "MCP Test Verifier",
      },
    };

    client = new PactraAgentClient(envelope, registry);
    mcp = new PactraMcpAdapter(client);
  });

  it("exposes all official MCP tool definitions matching JSON Schema standards", () => {
    const tools = mcp.listTools();
    expect(tools.length).toBe(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("pactra_discover_services");
    expect(names).toContain("pactra_get_quote");
    expect(names).toContain("pactra_request_procurement");
    expect(names).toContain("pactra_submit_evidence");
    expect(names).toContain("pactra_get_task_status");

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(15);
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  it("dispatches pactra_discover_services with optional category filtering", async () => {
    const res = await mcp.callTool("pactra_discover_services", { category: "COMPUTE" });
    expect(res.isError).toBe(false);
    expect(res.content[0].type).toBe("text");
    const parsed = JSON.parse(res.content[0].text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    expect(parsed.every((s: any) => s.category === "COMPUTE")).toBe(true);
  });

  it("dispatches pactra_get_quote and checks TaskPolicy compliance", async () => {
    const res = await mcp.callTool("pactra_get_quote", { serviceId: "srv_compute_alpha" });
    expect(res.isError).toBe(false);
    const quote = JSON.parse(res.content[0].text);
    expect(quote.serviceId).toBe("srv_compute_alpha");
    expect(quote.authorized).toBe(true);
    expect(quote.unitPrice).toBe("2");
  });

  it("handles missing arguments in MCP tool calls gracefully with isError flag", async () => {
    const res = await mcp.callTool("pactra_get_quote", {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Missing required argument: serviceId");
  });

  it("dispatches pactra_request_procurement and returns valid JSON record", async () => {
    const res = await mcp.callTool("pactra_request_procurement", {
      serviceId: "srv_compute_alpha",
      payloadHash: "0xmodel_weights_sha256",
    });
    expect(res.isError).toBe(false);
    const record = JSON.parse(res.content[0].text);
    expect(record.status).toBe("SERVICE_ACCEPTED");
    expect(record.authToken.authorizedAmount).toBe("2");
  });

  it("dispatches pactra_submit_evidence and updates execution state", async () => {
    const procRes = await mcp.callTool("pactra_request_procurement", {
      serviceId: "srv_compute_alpha",
    });
    const record = JSON.parse(procRes.content[0].text);

    const evRes = await mcp.callTool("pactra_submit_evidence", {
      procurementId: record.procurementId,
    });
    expect(evRes.isError).toBe(false);
    const evidence = JSON.parse(evRes.content[0].text);
    expect(evidence.jobId).toBe(record.jobSpec.jobId);
    expect(evidence.outputHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("dispatches pactra_get_task_status reflecting remaining budget", async () => {
    const res = await mcp.callTool("pactra_get_task_status");
    expect(res.isError).toBe(false);
    const status = JSON.parse(res.content[0].text);
    expect(status.taskId).toBe("task_mcp_001");
    expect(status.totalEscrowAllocation).toBe("10");
    expect(status.isExpired).toBe(false);
  });

  it("returns clean error response when invoking an unknown tool", async () => {
    const res = await mcp.callTool("pactra_unknown_tool", {});
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Unknown Pactra MCP tool");
  });

  it("enforces policy boundary when MCP model attempts unauthorized capability", async () => {
    // DEPLOYMENT capability is NOT in envelope's allowedCapabilities
    const res = await mcp.callTool("pactra_request_procurement", {
      serviceId: "srv_deploy_delta",
    });
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("Policy Violation");
  });
});

describe("Pactra Level 4 — Privacy Invariants & Commitment Consistency", () => {
  it("derives deterministic 32-byte opaque commitments from private inputs", () => {
    const input1 = "Deploy model with confidential weights";
    const commit1 = "0x" + sha256Hex(input1);
    const commit2 = "0x" + sha256Hex(input1);

    expect(commit1).toBe(commit2);
    expect(commit1).toMatch(/^0x[a-f0-9]{64}$/);
    expect(commit1.length).toBe(66);
  });

  it("exhibits cryptographic avalanche effect when private prompts are modified", () => {
    const originalPrompt = "Deploy model with confidential weights";
    const tweakedPrompt = "Deploy model with confidential weightz"; // 1 char change

    const commitOriginal = sha256Hex(originalPrompt);
    const commitTweaked = sha256Hex(tweakedPrompt);

    expect(commitOriginal).not.toBe(commitTweaked);

    // Count matching hex characters
    let matchingChars = 0;
    for (let i = 0; i < commitOriginal.length; i++) {
      if (commitOriginal[i] === commitTweaked[i]) matchingChars++;
    }
    // High diffusion: only small fraction of characters match by chance
    expect(matchingChars / commitOriginal.length).toBeLessThan(0.3);
  });

  it("ensures zero plaintext leakage in public commitment digests", () => {
    const sensitiveSalt = "secret_creator_entropy_998877_do_not_leak";
    const prompt = "Confidential proprietary trading model training";
    const commitment = "0x" + sha256Hex(`${prompt}:${sensitiveSalt}`);

    expect(commitment).not.toContain("secret");
    expect(commitment).not.toContain("proprietary");
    expect(commitment).not.toContain("trading");
    expect(commitment).not.toContain("998877");
  });

  it("permits witness parameter changes while preserving on-chain commitment validity", () => {
    const policy = createTaskPolicy({
      taskId: "task_privacy_001",
      maxTotalBudget: 10n,
      maxSpendPerTransaction: 2n,
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: ["0xprovider_alpha_enclave_99a4c102"],
      allowedCapabilities: ["COMPUTE", "STORAGE"],
      expirationTimestamp: Date.now() + 3600000,
      completionConditionCommitment: "0xcondition_hash_valid",
    });

    const binding = createOnChainPolicyBinding(policy);
    expect(binding.capabilityBitmask).toBe(3); // COMPUTE (1) | STORAGE (2) = 3
    expect(binding.maxBudget).toBe(10n);

    // Validation succeeds when policy matches on-chain binding
    expect(validatePolicyAgainstOnChainBinding(policy, binding).valid).toBe(true);

    // Validation strictly fails if attacker attempts to expand capabilities off-chain
    const tamperedPolicy = {
      ...policy,
      allowedCapabilities: ["COMPUTE", "STORAGE", "DEPLOYMENT"] as any,
    };
    const tamperedResult = validatePolicyAgainstOnChainBinding(tamperedPolicy, binding);
    expect(tamperedResult.valid).toBe(false);
    expect(tamperedResult.reason).toContain("Policy commitment mismatch");
  });
});
