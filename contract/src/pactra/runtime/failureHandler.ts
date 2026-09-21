/**
 * Pactra — Autonomous Runtime Failure Handler & Backoff Engine
 *
 * Enforces safe failure modes for autonomous agent execution:
 * 1. Finite retry limits with exponential backoff.
 * 2. Deadline and budget expiration detection.
 * 3. Safe termination states: ABORTED, REFUNDED, or DISPUTED.
 *
 * CRITICAL SECURITY INVARIANT:
 * Autonomous processes must never retry indefinitely or exceed bounded budgets.
 */

import { AutonomousAgentState } from "./runtimeTypes.js";

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseBackoffMs: number;
  readonly maxBackoffMs: number;
  readonly deadlineTimestamp: number;
}

export interface FailureEvaluation {
  readonly shouldRetry: boolean;
  readonly nextState: AutonomousAgentState;
  readonly backoffDelayMs: number;
  readonly reason: string;
}

export class RuntimeFailureHandler {
  private retryCounts = new Map<string, number>();

  /**
   * Evaluates an execution failure and determines deterministic next action.
   */
  public evaluateFailure(
    stepId: string,
    error: Error | string,
    policy: RetryPolicy
  ): FailureEvaluation {
    const errorMsg = typeof error === "string" ? error : error.message;
    const now = Date.now();

    // 1. Check Deadline Expiration
    if (now >= policy.deadlineTimestamp) {
      return {
        shouldRetry: false,
        nextState: "EXPIRED",
        backoffDelayMs: 0,
        reason: `Task execution deadline expired at ${new Date(policy.deadlineTimestamp).toISOString()}.`,
      };
    }

    // 2. Check Fatal / Unrecoverable Violations
    if (
      errorMsg.includes("UNAUTHORIZED") ||
      errorMsg.includes("POLICY_BUDGET_EXCEEDED") ||
      errorMsg.includes("PER_TRANSACTION_LIMIT_EXCEEDED") ||
      errorMsg.includes("INSUFFICIENT_TASK_BUDGET") ||
      errorMsg.includes("UNAPPROVED_CATEGORY")
    ) {
      return {
        shouldRetry: false,
        nextState: "ABORTED",
        backoffDelayMs: 0,
        reason: `Fatal policy violation encountered: ${errorMsg}. Halting agent execution.`,
      };
    }

    // 3. Evaluate Retries for Transient Network or Service Failures
    const currentRetries = this.retryCounts.get(stepId) ?? 0;
    if (currentRetries >= policy.maxRetries) {
      return {
        shouldRetry: false,
        nextState: "ABORTED",
        backoffDelayMs: 0,
        reason: `Retry ceiling reached (${currentRetries}/${policy.maxRetries}) for step "${stepId}". Failing safely.`,
      };
    }

    // Increment retry count
    const nextRetry = currentRetries + 1;
    this.retryCounts.set(stepId, nextRetry);

    // Compute exponential backoff with jitter
    const exponentialDelay = policy.baseBackoffMs * Math.pow(2, nextRetry - 1);
    const delay = Math.min(exponentialDelay, policy.maxBackoffMs);

    return {
      shouldRetry: true,
      nextState: "RETRYING",
      backoffDelayMs: delay,
      reason: `Transient failure for step "${stepId}" (attempt ${nextRetry}/${policy.maxRetries}). Retrying in ${delay}ms: ${errorMsg}`,
    };
  }

  /**
   * Reset retry count for a step upon successful completion.
   */
  public recordSuccess(stepId: string): void {
    this.retryCounts.delete(stepId);
  }

  /**
   * Retrieve current retry count for a step.
   */
  public getRetryCount(stepId: string): number {
    return this.retryCounts.get(stepId) ?? 0;
  }
}
