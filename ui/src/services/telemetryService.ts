/**
 * Pactra — Privacy-Preserving Telemetry Service
 *
 * Implements non-invasive, privacy-preserving event logging for product analytics.
 *
 * STRICT PRIVACY INVARIANTS:
 * 1. NEVER collect task plaintext, prompts, policy preimages, or execution data.
 * 2. NEVER collect private keys, seed phrases, or wallet signing secrets.
 * 3. Only aggregate, non-sensitive operational lifecycle events are allowed.
 * 4. Events are stored locally in client-side memory / LocalStorage with export options.
 */

export type TelemetryEventType =
  | "ONBOARDING_STARTED"
  | "ONBOARDING_COMPLETED"
  | "WALLET_CONNECT_ATTEMPT"
  | "WALLET_CONNECT_SUCCESS"
  | "WALLET_CONNECT_FAILED"
  | "TASK_CREATED"
  | "PROCUREMENT_ATTEMPTED"
  | "PROCUREMENT_COMPLETED"
  | "VERIFICATION_SUCCESS"
  | "VERIFICATION_FAILED"
  | "SETTLEMENT_SUCCESS"
  | "REFUND_PROCESSED"
  | "DISPUTE_RAISED"
  | "ERROR_OCCURRED";

export interface TelemetryEvent {
  readonly eventId: string;
  readonly eventType: TelemetryEventType;
  readonly timestamp: number;
  readonly category: "ONBOARDING" | "WALLET" | "ESCROW" | "MARKETPLACE" | "VERIFIER" | "ERROR";
  readonly metadata?: Record<string, string | number | boolean>;
}

export interface AggregateProductMetrics {
  totalSessions: number;
  onboardingCompletions: number;
  walletConnections: number;
  tasksCreated: number;
  procurementsCompleted: number;
  verificationsPassed: number;
  verificationsFailed: number;
  settlements: number;
  refunds: number;
  errorCount: number;
}

export class TelemetryPrivacyViolationError extends Error {
  constructor(message: string) {
    super(`Telemetry Privacy Violation: ${message}`);
    this.name = "TelemetryPrivacyViolationError";
  }
}

const FORBIDDEN_KEY_PATTERNS = [
  /key/i,
  /secret/i,
  /seed/i,
  /mnemonic/i,
  /private/i,
  /prompt/i,
  /plaintext/i,
  /password/i,
  /credential/i,
];

const PRIVATE_KEY_HEX_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

export class TelemetryService {
  private events: TelemetryEvent[] = [];
  private readonly storageKey = "pactra_telemetry_events_v5";
  private isEnabled = true;

  constructor() {
    this.loadFromStorage();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Validate that metadata contains ZERO sensitive data.
   * Throws TelemetryPrivacyViolationError if sensitive fields are detected.
   */
  public sanitizeMetadata(metadata?: Record<string, any>): Record<string, string | number | boolean> | undefined {
    if (!metadata) return undefined;

    const sanitized: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(metadata)) {
      for (const pattern of FORBIDDEN_KEY_PATTERNS) {
        if (pattern.test(key)) {
          throw new TelemetryPrivacyViolationError(
            `Attempted to log sensitive metadata key "${key}". This violates Pactra privacy guarantees.`
          );
        }
      }

      if (typeof value === "string") {
        if (PRIVATE_KEY_HEX_PATTERN.test(value.trim())) {
          throw new TelemetryPrivacyViolationError(
            `Detected potential raw cryptographic secret in metadata value for key "${key}".`
          );
        }
        if (value.length > 256) {
          throw new TelemetryPrivacyViolationError(
            `Metadata string value for "${key}" exceeds 256 characters (possible prompt payload).`
          );
        }
        sanitized[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      } else {
        throw new TelemetryPrivacyViolationError(
          `Metadata values must be primitives (string, number, boolean). Received ${typeof value} for "${key}".`
        );
      }
    }

    return sanitized;
  }

  public recordEvent(
    eventType: TelemetryEventType,
    category: TelemetryEvent["category"],
    rawMetadata?: Record<string, any>
  ): TelemetryEvent {
    if (!this.isEnabled) {
      return {
        eventId: "disabled",
        eventType,
        timestamp: Date.now(),
        category,
      };
    }

    const sanitizedMetadata = this.sanitizeMetadata(rawMetadata);

    const event: TelemetryEvent = {
      eventId: `telem_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      eventType,
      timestamp: Date.now(),
      category,
      metadata: sanitizedMetadata,
    };

    this.events.push(event);
    if (this.events.length > 500) {
      this.events.shift();
    }

    this.saveToStorage();
    return event;
  }

  public getEvents(): readonly TelemetryEvent[] {
    return [...this.events];
  }

  public getAggregateMetrics(): AggregateProductMetrics {
    const metrics: AggregateProductMetrics = {
      totalSessions: 1,
      onboardingCompletions: 0,
      walletConnections: 0,
      tasksCreated: 0,
      procurementsCompleted: 0,
      verificationsPassed: 0,
      verificationsFailed: 0,
      settlements: 0,
      refunds: 0,
      errorCount: 0,
    };

    for (const ev of this.events) {
      switch (ev.eventType) {
        case "ONBOARDING_COMPLETED":
          metrics.onboardingCompletions++;
          break;
        case "WALLET_CONNECT_SUCCESS":
          metrics.walletConnections++;
          break;
        case "TASK_CREATED":
          metrics.tasksCreated++;
          break;
        case "PROCUREMENT_COMPLETED":
          metrics.procurementsCompleted++;
          break;
        case "VERIFICATION_SUCCESS":
          metrics.verificationsPassed++;
          break;
        case "VERIFICATION_FAILED":
          metrics.verificationsFailed++;
          break;
        case "SETTLEMENT_SUCCESS":
          metrics.settlements++;
          break;
        case "REFUND_PROCESSED":
          metrics.refunds++;
          break;
        case "ERROR_OCCURRED":
        case "WALLET_CONNECT_FAILED":
          metrics.errorCount++;
          break;
      }
    }

    return metrics;
  }

  public clear(): void {
    this.events = [];
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.events = JSON.parse(stored);
        }
      }
    } catch {
      this.events = [];
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(this.events));
      }
    } catch {
      // ignore
    }
  }
}

export const telemetryService = new TelemetryService();
