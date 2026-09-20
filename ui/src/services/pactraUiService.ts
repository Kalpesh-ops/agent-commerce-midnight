import {
  createTaskPolicy,
  TaskPolicy,
  computePolicyCommitment,
  AgentAuthorityManager,
  AgentOperatingBudget,
  createDefaultServiceRegistry,
  ServiceRegistry,
  ServiceDefinition,
  AgentTaskPlanner,
  TaskPlan,
  ProcurementEngine,
  ProcurementRecord,
  ComputeJobSpec,
  ExecutionEvidence,
  CompletionVerifier,
  ObjectiveConditionSpec,
  VerificationResult,
  DisputeRecord,
  MidnightCityAgentAdapter,
} from "../../../contract/src/index.js";

export interface PactraLevel2State {
  policy: TaskPolicy;
  policyCommitment: string;
  budgetSnapshot: AgentOperatingBudget;
  activePlan: TaskPlan | null;
  registryServices: ServiceDefinition[];
  activeProcurements: ProcurementRecord[];
  latestEvidence: ExecutionEvidence | null;
  verificationResult: VerificationResult | null;
  dispute: DisputeRecord | null;
  cityStatus: {
    registered: boolean;
    lastCityEvent: string | null;
  };
}

class PactraUiService {
  private registry: ServiceRegistry;
  private policy: TaskPolicy;
  private authority: AgentAuthorityManager;
  private planner: AgentTaskPlanner;
  private procurementEngine: ProcurementEngine;
  private verifier: CompletionVerifier;
  private cityAdapter: MidnightCityAgentAdapter;

  private activePlan: TaskPlan | null = null;
  private latestEvidence: ExecutionEvidence | null = null;
  private verificationResult: VerificationResult | null = null;
  private dispute: DisputeRecord | null = null;
  private lastCityEvent: string | null = null;

  constructor() {
    this.registry = createDefaultServiceRegistry();
    this.planner = new AgentTaskPlanner();
    this.verifier = new CompletionVerifier();

    // Default policy conforming to prompt specification:
    // User Treasury: $100
    // Task Escrow: $5
    // Agent Operating Authority: maximum $2 per individual procurement, maximum $5 total
    // Capabilities: COMPUTE, STORAGE
    // Approved services: 3
    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "job_proc_compute_01",
      expectedProviderCommitment: "0xprovider_compute_alpha_hash",
      expectedResultCommitment: "0xres_compute_matrix_done_8841a",
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Deterministic cryptographic execution evidence verifier",
    };
    const conditionCommitment = this.verifier.computeConditionCommitment(conditionSpec);

    this.policy = createTaskPolicy({
      taskId: "task_l2_compute_deploy_001",
      maxTotalBudget: 5n,
      maxSpendPerTransaction: 2n,
      approvedCategories: ["COMPUTE", "STORAGE"],
      approvedProviders: [
        "0xprovider_compute_alpha_hash",
        "0xprovider_storage_beta_hash",
        "0xprovider_validator_gamma_hash",
      ],
      allowedCapabilities: ["COMPUTE", "STORAGE"],
      expirationTimestamp: Date.now() + 24 * 60 * 60 * 1000,
      completionConditionCommitment: conditionCommitment,
    });

    this.authority = new AgentAuthorityManager({
      userTreasuryTotal: 100n,
      taskEscrowAllocation: 5n,
      policy: this.policy,
    });

    this.procurementEngine = new ProcurementEngine(this.authority, this.registry);
    this.cityAdapter = new MidnightCityAgentAdapter(this.procurementEngine);
  }

  public getState(): PactraLevel2State {
    return {
      policy: this.policy,
      policyCommitment: computePolicyCommitment(this.policy),
      budgetSnapshot: this.authority.getBudgetSnapshot(),
      activePlan: this.activePlan,
      registryServices: this.registry.listActiveServices(),
      activeProcurements: this.procurementEngine.listProcurements(),
      latestEvidence: this.latestEvidence,
      verificationResult: this.verificationResult,
      dispute: this.dispute,
      cityStatus: {
        registered: true,
        lastCityEvent: this.lastCityEvent,
      },
    };
  }

  public planObjective(userPrompt: string): TaskPlan {
    const plan = this.planner.generatePlan(userPrompt);
    this.activePlan = plan;
    return plan;
  }

  public async procureComputeJob(spec?: Partial<ComputeJobSpec>): Promise<ProcurementRecord> {
    const jobSpec: ComputeJobSpec = {
      jobId: spec?.jobId || "job_proc_compute_01",
      serviceId: spec?.serviceId || "srv_compute_alpha",
      inputDatasetHash: spec?.inputDatasetHash || "0xinput_training_matrix_v1",
      instructions: spec?.instructions || "Run matrix factorisation on dataset",
      maxDurationSeconds: spec?.maxDurationSeconds || 60,
    };

    const record = await this.procurementEngine.requestComputeJob(jobSpec);
    return record;
  }

  public async executeProcurement(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    const evidence = await this.procurementEngine.executeComputeJob(procurementId, simulateFailure);
    this.latestEvidence = evidence;
    return evidence;
  }

  public verifyCompletion(
    evidence: ExecutionEvidence,
    corruptCondition?: boolean
  ): VerificationResult {
    const spec: ObjectiveConditionSpec = {
      expectedJobId: corruptCondition ? "job_mismatched_999" : evidence.jobId,
      expectedProviderCommitment: evidence.providerCommitment,
      expectedResultCommitment: corruptCondition ? "0xcorrupted_hash_invalid" : evidence.outputHash,
      maxAllowedCost: 2n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Objective cryptographic condition verifier",
    };

    const result = this.verifier.verifyExecution(spec, evidence);
    this.verificationResult = result;
    if (result.verified) {
      this.authority.recordExpenditure(2n);
    }
    return result;
  }

  public disputeProcurement(procurementId: string, reason: string): DisputeRecord {
    const record = this.procurementEngine.getProcurement(procurementId);
    if (record) {
      record.status = "DISPUTED";
      record.failureReason = reason;
      const cost = this.registry.getService(record.jobSpec.serviceId)?.unitPrice || 0n;
      this.authority.releaseReservation(cost);
    }

    const dispute = this.verifier.raiseDispute(procurementId, reason);
    this.dispute = dispute;
    return dispute;
  }

  public testForbiddenWalletAction(action: string): void {
    this.authority.assertNoTreasuryAccess(action);
  }

  public dispatchCityHeartbeat(): string {
    const event = `City Node Heartbeat acknowledged. Agent autonomous runtime active. Timestamp: ${new Date().toISOString()}`;
    this.lastCityEvent = event;
    return event;
  }

  public resetDemo(): void {
    this.activePlan = null;
    this.latestEvidence = null;
    this.verificationResult = null;
    this.dispute = null;
    this.lastCityEvent = null;
    this.authority = new AgentAuthorityManager({
      userTreasuryTotal: 100n,
      taskEscrowAllocation: 5n,
      policy: this.policy,
    });
    this.procurementEngine = new ProcurementEngine(this.authority, this.registry);
  }
}

export const pactraUiService = new PactraUiService();
