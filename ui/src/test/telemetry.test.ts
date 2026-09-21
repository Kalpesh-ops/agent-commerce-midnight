import { describe, it, expect, beforeEach } from "vitest";
import {
  TelemetryService,
  TelemetryPrivacyViolationError,
} from "../services/telemetryService";

describe("TelemetryService — Privacy-Preserving Analytics Invariants", () => {
  let telemetry: TelemetryService;

  beforeEach(() => {
    telemetry = new TelemetryService();
    telemetry.clear();
    telemetry.setEnabled(true);
  });

  it("records valid non-sensitive aggregate events with metadata", () => {
    const event = telemetry.recordEvent("ONBOARDING_COMPLETED", "ONBOARDING", {
      stepCount: 4,
      network: "preprod",
      success: true,
    });

    expect(event.eventId).toMatch(/^telem_/);
    expect(event.eventType).toBe("ONBOARDING_COMPLETED");
    expect(event.category).toBe("ONBOARDING");
    expect(event.metadata?.stepCount).toBe(4);
    expect(telemetry.getEvents().length).toBe(1);
  });

  it("calculates aggregate metrics correctly across lifecycle events", () => {
    telemetry.recordEvent("ONBOARDING_COMPLETED", "ONBOARDING");
    telemetry.recordEvent("WALLET_CONNECT_SUCCESS", "WALLET");
    telemetry.recordEvent("TASK_CREATED", "ESCROW");
    telemetry.recordEvent("PROCUREMENT_COMPLETED", "MARKETPLACE");
    telemetry.recordEvent("VERIFICATION_SUCCESS", "VERIFIER");
    telemetry.recordEvent("SETTLEMENT_SUCCESS", "ESCROW");
    telemetry.recordEvent("REFUND_PROCESSED", "ESCROW");
    telemetry.recordEvent("ERROR_OCCURRED", "ERROR");

    const metrics = telemetry.getAggregateMetrics();
    expect(metrics.onboardingCompletions).toBe(1);
    expect(metrics.walletConnections).toBe(1);
    expect(metrics.tasksCreated).toBe(1);
    expect(metrics.procurementsCompleted).toBe(1);
    expect(metrics.verificationsPassed).toBe(1);
    expect(metrics.settlements).toBe(1);
    expect(metrics.refunds).toBe(1);
    expect(metrics.errorCount).toBe(1);
  });

  it("CRITICAL: rejects forbidden sensitive keys matching /private|key|secret|seed|prompt/i", () => {
    expect(() => {
      telemetry.recordEvent("TASK_CREATED", "ESCROW", {
        userPrivateKey: "0x123",
      });
    }).toThrow(TelemetryPrivacyViolationError);

    expect(() => {
      telemetry.recordEvent("TASK_CREATED", "ESCROW", {
        walletSeedPhrase: "word1 word2 word3",
      });
    }).toThrow(TelemetryPrivacyViolationError);

    expect(() => {
      telemetry.recordEvent("TASK_CREATED", "ESCROW", {
        systemPrompt: "You are an agent",
      });
    }).toThrow(TelemetryPrivacyViolationError);

    expect(() => {
      telemetry.recordEvent("TASK_CREATED", "ESCROW", {
        secretWitness: "preimage_xyz",
      });
    }).toThrow(TelemetryPrivacyViolationError);
  });

  it("CRITICAL: rejects 64-character raw hex private keys in values", () => {
    const rawPrivateKeyHex = "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
    expect(() => {
      telemetry.recordEvent("ERROR_OCCURRED", "ERROR", {
        diagnosticData: rawPrivateKeyHex,
      });
    }).toThrow(TelemetryPrivacyViolationError);
  });

  it("CRITICAL: rejects string values exceeding 256 characters (prompt payload protection)", () => {
    const hugeString = "A".repeat(300);
    expect(() => {
      telemetry.recordEvent("TASK_CREATED", "ESCROW", {
        description: hugeString,
      });
    }).toThrow(TelemetryPrivacyViolationError);
  });

  it("respects telemetry opt-out when setEnabled(false)", () => {
    telemetry.setEnabled(false);
    const event = telemetry.recordEvent("TASK_CREATED", "ESCROW");
    expect(event.eventId).toBe("disabled");
    expect(telemetry.getEvents().length).toBe(0);
  });
});
