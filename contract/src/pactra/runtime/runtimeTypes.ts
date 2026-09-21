/**
 * Pactra — Headless Autonomous Agent Runtime Types & State Machine
 *
 * Defines the 13 explicit states for safe autonomous execution,
 * failure recovery, and audit tracking.
 */

export type AutonomousAgentState =
  | "RUNNING"
  | "WAITING_FOR_QUOTE"
  | "WAITING_FOR_AUTHORIZATION"
  | "PROCUREMENT_PENDING"
  | "EXECUTING"
  | "WAITING_FOR_PROOF"
  | "WAITING_FOR_VERIFICATION"
  | "DISPUTED"
  | "RETRYING"
  | "EXPIRED"
  | "COMPLETED"
  | "REFUNDED"
  | "ABORTED";

export interface StateTransitionEvent {
  readonly fromState: AutonomousAgentState;
  readonly toState: AutonomousAgentState;
  readonly timestamp: number;
  readonly rationale: string;
  readonly metadata?: Record<string, unknown>;
}

export interface RuntimeExecutionStep {
  readonly stepId: string;
  readonly capability: "COMPUTE" | "STORAGE" | "API_CALL" | "DEPLOYMENT" | "DATA_PROCESSING";
  readonly targetServiceId: string;
  readonly payloadHash?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
}

export interface RuntimePlan {
  readonly planId: string;
  readonly taskId: string;
  readonly steps: readonly RuntimeExecutionStep[];
  readonly deadlineTimestamp: number;
}

export interface RuntimeExecutionSummary {
  readonly taskId: string;
  readonly currentState: AutonomousAgentState;
  readonly totalSpent: bigint;
  readonly remainingBudget: bigint;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly retryCount: number;
  readonly transitions: readonly StateTransitionEvent[];
  readonly isTerminal: boolean;
}
