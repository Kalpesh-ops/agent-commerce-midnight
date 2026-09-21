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
  ServiceRequestSpec,
  ExecutionEvidence,
  CompletionVerifier,
  ObjectiveConditionSpec,
  VerificationResult,
  DisputeRecord,
  MidnightCityAgentAdapter,
  ArbitrationBoard,
  createDefaultArbitrationBoard,
  MultiPartyDispute,
  Arbitrator,
  ArbitrationVerdict,
  createOnChainPolicyBinding,
  OnChainPolicyBinding,
  AgentCapability,
} from "../../../contract/src/index.js";

export type PactraLevel2State = PactraProtocolState;

export interface PactraProtocolState {
  policy: TaskPolicy;
  policyCommitment: string;
  onChainBinding: OnChainPolicyBinding;
  budgetSnapshot: AgentOperatingBudget;
  activePlan: TaskPlan | null;
  registryServices: ServiceDefinition[];
  activeProcurements: ProcurementRecord[];
  latestEvidence: ExecutionEvidence | null;
  verificationResult: VerificationResult | null;
  dispute: DisputeRecord | null;
  arbitrationDisputes: MultiPartyDispute[];
  arbitrators: Arbitrator[];
  cityStatus: {
    registered: boolean;
    lastCityEvent: string | null;
  };
}

class PactraUiService {
  private registry: ServiceRegistry;
  private policy: TaskPolicy;
  private onChainBinding: OnChainPolicyBinding;
  private authority: AgentAuthorityManager;
  private planner: AgentTaskPlanner;
  private procurementEngine: ProcurementEngine;
  private verifier: CompletionVerifier;
  private arbitrationBoard: ArbitrationBoard;
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
    this.arbitrationBoard = createDefaultArbitrationBoard();

    const conditionSpec: ObjectiveConditionSpec = {
      expectedJobId: "job_proc_compute_01",
      expectedProviderCommitment: "0xprovider_alpha_enclave_99a4c102",
      expectedResultCommitment: undefined,
      maxAllowedCost: 3n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Deterministic cryptographic execution evidence verifier",
    };
    const conditionCommitment = this.verifier.computeConditionCommitment(conditionSpec);

    this.policy = createTaskPolicy({
      taskId: "task_l3_autonomous_001",
      maxTotalBudget: 10n,
      maxSpendPerTransaction: 3n,
      approvedCategories: [
        "COMPUTE",
        "STORAGE",
        "API_CALL",
        "DEPLOYMENT",
        "DATA_PROCESSING",
      ],
      approvedProviders: [
        "0xprovider_alpha_enclave_99a4c102",
        "0xprovider_beta_worker_77c2e501",
        "0xprovider_gamma_store_44f1b883",
        "0xprovider_api_gateway_33d8a901",
        "0xprovider_deploy_delta_55b2c404",
        "0xprovider_dataproc_eps_11e7a202",
      ],
      allowedCapabilities: [
        "COMPUTE",
        "STORAGE",
        "API_CALL",
        "DEPLOYMENT",
        "DATA_PROCESSING",
      ],
      expirationTimestamp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      completionConditionCommitment: conditionCommitment,
    });

    this.onChainBinding = createOnChainPolicyBinding(this.policy);

    this.authority = new AgentAuthorityManager({
      userTreasuryTotal: 100n,
      taskEscrowAllocation: 10n,
      policy: this.policy,
    });

    this.procurementEngine = new ProcurementEngine(this.authority, this.registry);
    this.cityAdapter = new MidnightCityAgentAdapter(this.procurementEngine);
  }

  public getState(): PactraProtocolState {
    return {
      policy: this.policy,
      policyCommitment: computePolicyCommitment(this.policy),
      onChainBinding: this.onChainBinding,
      budgetSnapshot: this.authority.getBudgetSnapshot(),
      activePlan: this.activePlan,
      registryServices: this.registry.listAllServices(),
      activeProcurements: this.procurementEngine.listProcurements(),
      latestEvidence: this.latestEvidence,
      verificationResult: this.verificationResult,
      dispute: this.dispute,
      arbitrationDisputes: this.arbitrationBoard.listDisputes(),
      arbitrators: this.arbitrationBoard.getArbitrators(),
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

  public validatePlan(plan: TaskPlan) {
    return this.planner.validatePlanAgainstPolicy(plan, this.policy);
  }

  public async procureComputeJob(spec?: Partial<ComputeJobSpec>): Promise<ProcurementRecord> {
    const jobSpec: ComputeJobSpec = {
      jobId: spec?.jobId || `job_compute_${Date.now().toString(36)}`,
      serviceId: spec?.serviceId || "srv_compute_alpha",
      capability: "COMPUTE",
      inputPayloadHash: spec?.inputDatasetHash || "0xinput_training_matrix_v1",
      inputDatasetHash: spec?.inputDatasetHash || "0xinput_training_matrix_v1",
      instructions: spec?.instructions || "Run matrix factorisation on dataset",
      maxDurationSeconds: spec?.maxDurationSeconds || 60,
    };

    const record = await this.procurementEngine.requestComputeJob(jobSpec);
    return record;
  }

  public async procureMarketplaceService(
    serviceId: string,
    customPayload?: string
  ): Promise<ProcurementRecord> {
    const service = this.registry.getService(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found in marketplace.`);
    }

    const spec: ServiceRequestSpec = {
      jobId: `job_${service.category.toLowerCase()}_${Date.now().toString(36)}`,
      serviceId: service.serviceId,
      capability: service.category,
      inputPayloadHash: customPayload || `0xpayload_${service.serviceId}_${Date.now()}`,
      maxDurationSeconds: service.evidenceRequirement?.maxDurationSeconds ?? 3600,
    };

    return this.procurementEngine.requestService(spec);
  }

  public async executeProcurement(
    procurementId: string,
    simulateFailure?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE" | "REPLAY_EVIDENCE"
  ): Promise<ExecutionEvidence> {
    const evidence = await this.procurementEngine.executeService(procurementId, simulateFailure);
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
      maxAllowedCost: 3n,
      isSubjectiveTask: false,
      externalVerifierRequired: false,
      verifierDescription: "Objective cryptographic condition verifier",
    };

    const result = this.verifier.verifyExecution(spec, evidence);
    this.verificationResult = result;
    if (result.verified) {
      this.authority.recordExpenditure(evidence.costIncurred);
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

  public openArbitrationDispute(params: {
    procurementId: string;
    claimant: "CREATOR" | "PROVIDER" | "AGENT" | "AUTOMATED_VERIFIER";
    reason: string;
    amount: bigint;
  }): MultiPartyDispute {
    return this.arbitrationBoard.openDispute({
      procurementId: params.procurementId,
      taskId: this.policy.taskId,
      claimant: params.claimant,
      reason: params.reason,
      disputedAmount: params.amount,
      evidencePayloadHash: this.latestEvidence?.outputHash || "0xdisputed_evidence",
    });
  }

  public castArbitrationVote(
    disputeId: string,
    arbitratorId: string,
    verdict: ArbitrationVerdict,
    rationale: string
  ) {
    const result = this.arbitrationBoard.castVote(disputeId, arbitratorId, verdict, rationale);
    if (result.status === "RESOLVED_REFUND") {
      const dispute = this.arbitrationBoard.getDispute(disputeId);
      if (dispute) {
        this.authority.releaseReservation(dispute.disputedAmount);
      }
    } else if (result.status === "RESOLVED_SETTLE") {
      const dispute = this.arbitrationBoard.getDispute(disputeId);
      if (dispute) {
        this.authority.recordExpenditure(dispute.disputedAmount);
      }
    }
    return result;
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
      taskEscrowAllocation: 10n,
      policy: this.policy,
    });
    this.procurementEngine = new ProcurementEngine(this.authority, this.registry);
    this.arbitrationBoard = createDefaultArbitrationBoard();
  }
}

export const pactraUiService = new PactraUiService();
