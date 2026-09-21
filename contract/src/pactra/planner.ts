/**
 * Pactra — Agent Task Planner
 *
 * Deconstructs a high-level user objective into structured, machine-readable actions.
 *
 * NOTE: The AI task planner is an off-chain execution component; it is NOT cryptographically
 * proven itself. The TaskPolicy and Midnight Smart Contract provide the security boundary.
 */

import { AgentCapability, TaskPolicy } from "./policy.js";

export interface PlannedAction {
  readonly step: number;
  readonly actionId: string;
  readonly name: string;
  readonly description: string;
  readonly capability: AgentCapability;
  readonly estimatedCost: bigint;
  readonly serviceCategory: AgentCapability;
  readonly targetServiceId?: string;
  readonly dependsOn?: string[];
  status: "PENDING" | "AUTHORIZED" | "EXECUTING" | "COMPLETED" | "FAILED";
}

export interface TaskPlan {
  readonly planId: string;
  readonly userObjective: string;
  readonly generatedAt: number;
  readonly totalEstimatedCost: bigint;
  readonly actions: PlannedAction[];
  readonly architecturalDisclaimer: string;
}

export class AgentTaskPlanner {
  public generatePlan(userObjective: string): TaskPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const lower = userObjective.toLowerCase();

    let actions: PlannedAction[];

    if (lower.includes("deploy") || (lower.includes("app") && lower.includes("running"))) {
      // Full Autonomous Deployment Pipeline
      actions = [
        {
          step: 1,
          actionId: "act_01_compute",
          name: "Obtain compute",
          description: "Procure confidential virtual enclave worker for hosting container.",
          capability: "COMPUTE",
          estimatedCost: 2n,
          serviceCategory: "COMPUTE",
          targetServiceId: "srv_compute_alpha",
          status: "PENDING",
        },
        {
          step: 2,
          actionId: "act_02_storage",
          name: "Obtain storage",
          description: "Allocate encrypted persistent volume for runtime state.",
          capability: "STORAGE",
          estimatedCost: 1n,
          serviceCategory: "STORAGE",
          targetServiceId: "srv_storage_gamma",
          dependsOn: ["act_01_compute"],
          status: "PENDING",
        },
        {
          step: 3,
          actionId: "act_03_deploy",
          name: "Deploy application",
          description: "Execute container bootstrap sequence inside isolated enclave.",
          capability: "DEPLOYMENT",
          estimatedCost: 2n,
          serviceCategory: "DEPLOYMENT",
          targetServiceId: "srv_deploy_delta",
          dependsOn: ["act_01_compute", "act_02_storage"],
          status: "PENDING",
        },
        {
          step: 4,
          actionId: "act_04_health",
          name: "Run health checks",
          description: "Verify uptime, response signatures, and SLA telemetry.",
          capability: "API_CALL",
          estimatedCost: 1n,
          serviceCategory: "API_CALL",
          targetServiceId: "srv_api_gateway",
          dependsOn: ["act_03_deploy"],
          status: "PENDING",
        },
        {
          step: 5,
          actionId: "act_05_evidence",
          name: "Submit completion evidence",
          description: "Compile signed execution logs and hash proof for escrow settlement.",
          capability: "DATA_PROCESSING",
          estimatedCost: 1n,
          serviceCategory: "DATA_PROCESSING",
          targetServiceId: "srv_dataproc_epsilon",
          dependsOn: ["act_04_health"],
          status: "PENDING",
        },
      ];
    } else if (lower.includes("dataset") || lower.includes("process") || lower.includes("index")) {
      // Data Processing & Verification Pipeline
      actions = [
        {
          step: 1,
          actionId: "act_01_storage",
          name: "Retrieve Dataset Volume",
          description: "Mount encrypted distributed volume containing input matrix.",
          capability: "STORAGE",
          estimatedCost: 1n,
          serviceCategory: "STORAGE",
          targetServiceId: "srv_storage_gamma",
          status: "PENDING",
        },
        {
          step: 2,
          actionId: "act_02_compute",
          name: "Confidential Data Transformation",
          description: "Execute verifiable zero-knowledge data normalization and indexing.",
          capability: "DATA_PROCESSING",
          estimatedCost: 1n,
          serviceCategory: "DATA_PROCESSING",
          targetServiceId: "srv_dataproc_epsilon",
          dependsOn: ["act_01_storage"],
          status: "PENDING",
        },
        {
          step: 3,
          actionId: "act_03_oracle",
          name: "Oracle Attestation",
          description: "Submit transformed Merkle root to Oracle API Gateway for signature.",
          capability: "API_CALL",
          estimatedCost: 1n,
          serviceCategory: "API_CALL",
          targetServiceId: "srv_api_gateway",
          dependsOn: ["act_02_compute"],
          status: "PENDING",
        },
      ];
    } else {
      // General Compute / Task Plan
      actions = [
        {
          step: 1,
          actionId: "act_01_alloc_compute",
          name: "Allocate Compute Resource",
          description: "Request authorized confidential worker from service registry.",
          capability: "COMPUTE",
          estimatedCost: 2n,
          serviceCategory: "COMPUTE",
          targetServiceId: "srv_compute_alpha",
          status: "PENDING",
        },
        {
          step: 2,
          actionId: "act_02_execute",
          name: "Execute Compute Job",
          description: "Dispatch parameters to provider inside zero-knowledge enclave.",
          capability: "COMPUTE",
          estimatedCost: 0n,
          serviceCategory: "COMPUTE",
          targetServiceId: "srv_compute_alpha",
          dependsOn: ["act_01_alloc_compute"],
          status: "PENDING",
        },
        {
          step: 3,
          actionId: "act_03_verify",
          name: "Evaluate Evidence & Commit",
          description: "Verify SHA-256 output commitment and prepare settlement circuit input.",
          capability: "DATA_PROCESSING",
          estimatedCost: 1n,
          serviceCategory: "DATA_PROCESSING",
          targetServiceId: "srv_dataproc_epsilon",
          dependsOn: ["act_02_execute"],
          status: "PENDING",
        },
      ];
    }

    const totalEstimatedCost = actions.reduce((acc, act) => acc + act.estimatedCost, 0n);

    return {
      planId,
      userObjective,
      generatedAt: Date.now(),
      totalEstimatedCost,
      actions,
      architecturalDisclaimer:
        "The planner is an off-chain execution component. The TaskPolicy and Midnight Smart Contract enforce all cryptographic boundaries.",
    };
  }

  /**
   * Pre-checks whether a generated plan complies with a given TaskPolicy before execution.
   */
  public validatePlanAgainstPolicy(
    plan: TaskPlan,
    policy: TaskPolicy
  ): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];

    // 1. Check total budget
    if (plan.totalEstimatedCost > policy.maxTotalBudget) {
      violations.push(
        `Total plan estimated cost (${plan.totalEstimatedCost}) exceeds policy budget (${policy.maxTotalBudget}).`
      );
    }

    // 2. Check capabilities
    for (const action of plan.actions) {
      if (!policy.allowedCapabilities.includes(action.capability)) {
        violations.push(
          `Action "${action.name}" requires capability "${action.capability}" which is NOT allowed by policy.`
        );
      }
      if (action.estimatedCost > policy.maxSpendPerTransaction) {
        violations.push(
          `Action "${action.name}" estimated cost (${action.estimatedCost}) exceeds per-transaction limit (${policy.maxSpendPerTransaction}).`
        );
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }
}
