/**
 * Pactra — Midnight City Agent Runtime Adapter
 *
 * Provides a clean, decoupled adapter enabling Pactra autonomous agents
 * to operate inside the Midnight City simulation / agent environment.
 *
 * DECOUPLING INVARIANT: The core Pactra protocol operates completely independently.
 * This adapter serves solely as an external bridge for Midnight City agent runtimes,
 * translating City economic intents into policy-governed Pactra procurements.
 */

import { AgentCapability, PolicyViolationError } from "./policy.js";
import { ProcurementEngine, ProcurementRecord } from "./procurement.js";

export interface MidnightCityIntent {
  readonly intentId: string;
  readonly agentCitizenId: string;
  readonly actionType: "PROCURE_RESOURCE" | "EXECUTE_CONTRACT" | "REPORT_TELEMETRY";
  readonly serviceCategory: AgentCapability;
  readonly budgetLimit: bigint;
  readonly payload: Record<string, unknown>;
  readonly timestamp: number;
}

export interface MidnightCityIntentResult {
  readonly intentId: string;
  readonly accepted: boolean;
  readonly procurement?: ProcurementRecord;
  readonly error?: string;
  readonly timestamp: number;
}

export class MidnightCityAgentAdapter {
  constructor(private readonly procurementEngine: ProcurementEngine) {}

  /**
   * Translates an autonomous Midnight City intent into a policy-checked Pactra procurement.
   */
  public async handleCityIntent(intent: MidnightCityIntent): Promise<MidnightCityIntentResult> {
    try {
      if (intent.actionType !== "PROCURE_RESOURCE") {
        return {
          intentId: intent.intentId,
          accepted: false,
          error: `Unsupported City actionType: ${intent.actionType}. Only PROCURE_RESOURCE is supported.`,
          timestamp: Date.now(),
        };
      }

      const serviceId = (intent.payload.targetServiceId as string) || "srv_compute_alpha";
      const jobId = `city_job_${intent.intentId}`;

      const procurement = await this.procurementEngine.requestComputeJob({
        jobId,
        serviceId,
        inputDatasetHash: (intent.payload.dataHash as string) || "0xcity_sim_input_hash_44a1b9",
        instructions: (intent.payload.instructions as string) || "Execute autonomous city task",
        maxDurationSeconds: 60,
      });

      return {
        intentId: intent.intentId,
        accepted: true,
        procurement,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      return {
        intentId: intent.intentId,
        accepted: false,
        error: err instanceof PolicyViolationError ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }

  public getAdapterVersion(): string {
    return "Pactra-MidnightCity-Adapter/1.0.0 (Decoupled)";
  }
}
