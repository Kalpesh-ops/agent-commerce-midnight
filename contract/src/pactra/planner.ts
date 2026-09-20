/**
 * Pactra — Agent Task Planner
 *
 * Deconstructs a high-level user objective into structured, machine-readable actions.
 *
 * NOTE: The AI task planner is an off-chain execution component; it is NOT cryptographically
 * proven itself. The TaskPolicy and Midnight Smart Contract provide the security boundary.
 */

import { AgentCapability } from "./policy.js";

export interface PlannedAction {
  readonly step: number;
  readonly actionId: string;
  readonly name: string;
  readonly description: string;
  readonly capability: AgentCapability;
  readonly estimatedCost: bigint;
  readonly serviceCategory: AgentCapability;
  readonly targetServiceId?: string;
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

    if (lower.includes("deploy") && lower.includes("running")) {
      // "Deploy my application and keep it running for 24 hours"
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
          status: "PENDING",
        },
        {
          step: 3,
          actionId: "act_03_deploy",
          name: "Deploy application",
          description: "Execute container bootstrap sequence inside isolated enclave.",
          capability: "DEPLOYMENT",
          estimatedCost: 0n,
          serviceCategory: "COMPUTE",
          status: "PENDING",
        },
        {
          step: 4,
          actionId: "act_04_health",
          name: "Run health checks",
          description: "Verify uptime, response signatures, and SLA telemetry.",
          capability: "API_CALL",
          estimatedCost: 0n,
          serviceCategory: "API_CALL",
          status: "PENDING",
        },
        {
          step: 5,
          actionId: "act_05_evidence",
          name: "Submit completion evidence",
          description: "Compile signed execution logs and hash proof for escrow settlement.",
          capability: "DATA_PROCESSING",
          estimatedCost: 0n,
          serviceCategory: "DATA_PROCESSING",
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
          status: "PENDING",
        },
        {
          step: 3,
          actionId: "act_03_verify",
          name: "Evaluate Evidence & Commit",
          description: "Verify SHA-256 output commitment and prepare settlement circuit input.",
          capability: "DATA_PROCESSING",
          estimatedCost: 0n,
          serviceCategory: "DATA_PROCESSING",
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
}
