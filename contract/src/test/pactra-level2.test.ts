/**
 * Pactra — Level 2 Protocol Invariant & Security Verification Tests
 *
 * Covers all 12 required test scenarios:
 * 1. Unauthorized capability rejection
 * 2. Over-budget procurement rejection
 * 3. Unauthorized provider rejection
 * 4. Excessive service price rejection
 * 5. Expired task rejection
 * 6. Duplicate / invalid procurement transition rejection
 * 7. Invalid execution evidence detection
 * 8. Failed objective verification
 * 9. Successful verification path
 * 10. Successful settlement path
 * 11. Failure & Dispute / Refund path
 * 12. Agent attempting unauthorized wallet action (Strict Zero-Treasury-Access Invariant)
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTaskPolicy,
  PolicyViolationError,
  AgentAuthorityManager,
  ServiceRegistry,
  createDefaultServiceRegistry,
  AgentTaskPlanner,
  ProcurementEngine,
  CompletionVerifier,
  ObjectiveConditionSpec,
  MidnightCityAgentAdapter,
} from "../pactra/index.js";

describe("Pactra Level 2 — Protocol Invariant & Security Test Suite", () => {
  let registry: ServiceRegistry;
  let authority: AgentAuthorityManager;
  let procurementEngine: ProcurementEngine;
  let verifier: CompletionVerifier;
  const taskId = "0xtask_unit_test_level2_000000000001";
  const validProvider = "0xprovider_alpha_enclave_99a4c102";

  beforeEach(() => {
    registry = createDefaultServiceRegistry();
    verifier = new CompletionVerifier();

    const policy = createTaskPolicy({
      taskId,
      maxTotalBudget: 5n,
      maxSpendPerTransaction: 2n,
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: [validProvider, "0xprovider_gamma_store_44f1b883"],
      allowedCapabilities: ["COMPUTE", "STORAGE", "DATA_PROCESSING"],
      expirationTimestamp: Date.now() + 3600 * 1000,
      completionConditionCommitment: "0xcond_sha256_mock_spec",
    });

    authority = new AgentAuthorityManager({
      userTreasuryTotal: 100n,
      taskEscrowAllocation: 5n,
      policy,
    });

    procurementEngine = new ProcurementEngine(authority, registry);
  });

  // Test 1: Unauthorized capability
  it("1. blocks procurement when agent requests an unauthorized capability", async () => {
    expect(() => {
      authority.authorizeProcurement({
        capability: "DEPLOYMENT", // Not in allowedCapabilities
        providerId: validProvider,
        requestedAmount: 2n,
        serviceCategory: "COMPUTE",
        objectiveRef: "job_deploy_unauthorized",
      });
    }).toThrow(PolicyViolationError);

    expect(() => {
      authority.authorizeProcurement({
        capability: "DEPLOYMENT",
        providerId: validProvider,
        requestedAmount: 2n,
        serviceCategory: "COMPUTE",
        objectiveRef: "job_deploy_unauthorized",
      });
    }).toThrow(/UNAUTHORIZED_CAPABILITY/);
  });

  // Test 2: Over-budget request
  it("2. blocks procurement that exceeds total allocated task budget", async () => {
    // 1st procurement: 2 DUST
    await procurementEngine.requestComputeJob({
      jobId: "job_01",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xdataset_hash_01",
      instructions: "Run task part 1",
      maxDurationSeconds: 10,
    });

    // 2nd procurement: 2 DUST
    await procurementEngine.requestComputeJob({
      jobId: "job_02",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xdataset_hash_02",
      instructions: "Run task part 2",
      maxDurationSeconds: 10,
    });

    // 3rd procurement: 2 DUST -> would reach 6 DUST (exceeds 5 DUST total)
    await expect(
      procurementEngine.requestComputeJob({
        jobId: "job_03",
        serviceId: "srv_compute_alpha",
        inputDatasetHash: "0xdataset_hash_03",
        instructions: "Run task part 3",
        maxDurationSeconds: 10,
      })
    ).rejects.toThrow(/BUDGET_EXHAUSTED/);
  });

  // Test 3: Unauthorized provider
  it("3. blocks procurement with an unapproved provider", async () => {
    // Register a rogue provider not in policy.approvedProviders
    registry.registerService({
      serviceId: "srv_rogue_compute",
      name: "Rogue Compute Worker",
      providerCommitment: "0xunauthorized_rogue_provider_666",
      category: "COMPUTE",
      unitPrice: 1n,
      maxPrice: 2n,
      verificationMethod: "EXECUTION_EVIDENCE",
      status: "ACTIVE",
    });

    await expect(
      procurementEngine.requestComputeJob({
        jobId: "job_rogue",
        serviceId: "srv_rogue_compute",
        inputDatasetHash: "0xdataset_rogue",
        instructions: "Run rogue work",
        maxDurationSeconds: 5,
      })
    ).rejects.toThrow(/UNAPPROVED_PROVIDER/);
  });

  // Test 4: Excessive service price
  it("4. blocks procurement if service quote exceeds max price bounds", async () => {
    // Provider charges 10 DUST, exceeding both service max and per-tx limit (2 DUST)
    registry.registerService({
      serviceId: "srv_expensive_worker",
      name: "Overpriced Compute Worker",
      providerCommitment: validProvider,
      category: "COMPUTE",
      unitPrice: 10n,
      maxPrice: 10n,
      verificationMethod: "EXECUTION_EVIDENCE",
      status: "ACTIVE",
    });

    await expect(
      procurementEngine.requestComputeJob({
        jobId: "job_expensive",
        serviceId: "srv_expensive_worker",
        inputDatasetHash: "0xdataset_expensive",
        instructions: "Expensive task",
        maxDurationSeconds: 5,
      })
    ).rejects.toThrow(/PER_TX_LIMIT_EXCEEDED/);
  });

  // Test 5: Expired task
  it("5. blocks procurement on an expired task policy", async () => {
    const expiredPolicy = createTaskPolicy({
      taskId: "0xtask_expired_001",
      maxTotalBudget: 5n,
      maxSpendPerTransaction: 2n,
      approvedCategories: ["COMPUTE"],
      approvedProviders: [validProvider],
      allowedCapabilities: ["COMPUTE"],
      expirationTimestamp: Date.now() + 10, // 10ms in future
      completionConditionCommitment: "0xcond_mock",
    });

    const expiredAuthority = new AgentAuthorityManager({
      userTreasuryTotal: 100n,
      taskEscrowAllocation: 5n,
      policy: expiredPolicy,
    });

    const expiredEngine = new ProcurementEngine(expiredAuthority, registry);

    // Wait 25ms to ensure timestamp has passed
    await new Promise((r) => setTimeout(r, 25));

    await expect(
      expiredEngine.requestComputeJob({
        jobId: "job_expired",
        serviceId: "srv_compute_alpha",
        inputDatasetHash: "0xhash",
        instructions: "Expired task",
        maxDurationSeconds: 5,
      })
    ).rejects.toThrow(/TASK_EXPIRED/);
  });

  // Test 6: Duplicate or invalid state procurement transition
  it("6. rejects execution on duplicate or already-executed procurement", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_lifecycle_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xhash_dataset",
      instructions: "Run once",
      maxDurationSeconds: 10,
    });

    // Execute once
    await procurementEngine.executeComputeJob(proc.procurementId);

    // Attempt duplicate execution on the same procurement
    await expect(
      procurementEngine.executeComputeJob(proc.procurementId)
    ).rejects.toThrow(/INVALID_STATE_TRANSITION/);
  });

  // Test 7: Invalid evidence
  it("7. detects and flags invalid or corrupted execution evidence", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_corrupt_evidence_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xhash_dataset",
      instructions: "Corrupt simulation",
      maxDurationSeconds: 10,
    });

    const evidence = await procurementEngine.executeComputeJob(proc.procurementId, "INVALID_EVIDENCE");
    expect(proc.status).toBe("EVIDENCE_INVALID");

    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "job_corrupt_evidence_test",
      expectedProviderCommitment: validProvider,
      expectedResultCommitment: "0xexpected_valid_hash_different",
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Verify output hash matches expected result",
    };

    const result = verifier.verifyExecution(conditionSpec, evidence);
    expect(result.verified).toBe(false);
    expect(result.checks.resultMatchesCommitment).toBe(false);
  });

  // Test 8: Failed verification
  it("8. fails verification when evidence fails condition checks", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_fail_check_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xhash_dataset",
      instructions: "Job to fail check",
      maxDurationSeconds: 10,
    });

    const evidence = await procurementEngine.executeComputeJob(proc.procurementId);

    // Mismatched expectedJobId
    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "wrong_job_id_expected",
      expectedProviderCommitment: validProvider,
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Expects different job id",
    };

    const result = verifier.verifyExecution(conditionSpec, evidence);
    expect(result.verified).toBe(false);
    expect(result.checks.jobIdMatches).toBe(false);
    expect(result.failureReason).toContain("Job ID mismatch");
  });

  // Test 9: Successful verification
  it("9. successfully verifies valid evidence satisfying all objective conditions", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_success_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xinput_data_verified",
      instructions: "Clean verifiable job",
      maxDurationSeconds: 10,
    });

    const evidence = await procurementEngine.executeComputeJob(proc.procurementId);

    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "job_success_test",
      expectedProviderCommitment: validProvider,
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Verify job output and price",
    };

    const result = verifier.verifyExecution(conditionSpec, evidence);
    expect(result.verified).toBe(true);
    expect(result.checks.jobIdMatches).toBe(true);
    expect(result.checks.providerAuthorized).toBe(true);
    expect(result.checks.withinCostBound).toBe(true);
    expect(result.completionHash).toBe(evidence.outputHash);
  });

  // Test 10: Successful settlement path
  it("10. records expenditure upon successful verification and settlement", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_settlement_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xinput_settle",
      instructions: "Settlement path",
      maxDurationSeconds: 10,
    });

    const evidence = await procurementEngine.executeComputeJob(proc.procurementId);

    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "job_settlement_test",
      expectedProviderCommitment: validProvider,
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Verifiable settlement check",
    };

    const verification = verifier.verifyExecution(conditionSpec, evidence);
    expect(verification.verified).toBe(true);

    // Authority records expenditure
    authority.recordExpenditure(evidence.costIncurred);
    const budget = authority.getBudgetSnapshot();
    expect(budget.currentSpent).toBe(2n);
    expect(budget.remainingBudget).toBe(3n);
  });

  // Test 11: Failure & Dispute / Refund path
  it("11. supports failure handling, dispute raising, and refund path", async () => {
    const proc = await procurementEngine.requestComputeJob({
      jobId: "job_dispute_test",
      serviceId: "srv_compute_alpha",
      inputDatasetHash: "0xinput_data",
      instructions: "Simulate failure",
      maxDurationSeconds: 10,
    });

    // Simulate provider timeout
    await expect(
      procurementEngine.executeComputeJob(proc.procurementId, "TIMEOUT")
    ).rejects.toThrow(/SERVICE_TIMEOUT/);

    expect(proc.status).toBe("SERVICE_TIMEOUT");

    // Raise formal dispute
    const dispute = verifier.raiseDispute(proc.procurementId, "Provider timed out. Reclaiming escrow.");
    expect(dispute.disputeId).toBeDefined();
    expect(dispute.resolvedState).toBe("REFUNDED");
  });

  // Test 12: Agent attempting unauthorized wallet action
  it("12. strictly rejects agent attempts to perform generic wallet transactions or treasury drain", () => {
    expect(() => {
      authority.assertNoTreasuryAccess("sendTransaction(0xattacker, 100)");
    }).toThrow(PolicyViolationError);

    expect(() => {
      authority.assertNoTreasuryAccess("sendTransaction(0xattacker, 100)");
    }).toThrow(/UNAUTHORIZED_WALLET_ACTION/);

    expect(() => {
      authority.assertNoTreasuryAccess("drainTreasury()");
    }).toThrow(/UNAUTHORIZED_WALLET_ACTION/);

    expect(() => {
      authority.assertNoTreasuryAccess("exportKey()");
    }).toThrow(/UNAUTHORIZED_WALLET_ACTION/);
  });

  // Test 13: Task Planner structured action generation
  it("13. planner produces machine-readable actions for high-level user prompt", () => {
    const planner = new AgentTaskPlanner();
    const plan = planner.generatePlan("Deploy my application and keep it running for 24 hours.");

    expect(plan.actions.length).toBe(5);
    expect(plan.actions[0].name).toBe("Obtain compute");
    expect(plan.actions[0].capability).toBe("COMPUTE");
    expect(plan.actions[1].name).toBe("Obtain storage");
    expect(plan.actions[1].capability).toBe("STORAGE");
    expect(plan.actions[2].name).toBe("Deploy application");
    expect(plan.totalEstimatedCost).toBeGreaterThan(0n);
  });

  // Test 14: Midnight City Agent Adapter
  it("14. Midnight City agent adapter handles city intent and routes through Pactra policy", async () => {
    const cityAdapter = new MidnightCityAgentAdapter(procurementEngine);
    const result = await cityAdapter.handleCityIntent({
      intentId: "city_intent_001",
      agentCitizenId: "citizen_agent_77",
      actionType: "PROCURE_RESOURCE",
      serviceCategory: "COMPUTE",
      budgetLimit: 2n,
      payload: {
        targetServiceId: "srv_compute_alpha",
        dataHash: "0xcity_data_hash",
        instructions: "Run city simulation compute",
      },
      timestamp: Date.now(),
    });

    expect(result.accepted).toBe(true);
    expect(result.procurement).toBeDefined();
    expect(result.procurement?.jobSpec.serviceId).toBe("srv_compute_alpha");
  });
});
