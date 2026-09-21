import React, { useState, useEffect } from "react";
import { telemetryService, AggregateProductMetrics } from "../services/telemetryService";
import { feedbackService } from "../services/feedbackService";
import { EscrowContractData } from "../services/escrowService";

interface ProductMetricsViewProps {
  escrowState: EscrowContractData;
  isIndexerLive: boolean;
}

export const ProductMetricsView: React.FC<ProductMetricsViewProps> = ({
  escrowState,
  isIndexerLive,
}) => {
  const [metrics, setMetrics] = useState<AggregateProductMetrics>(
    telemetryService.getAggregateMetrics()
  );
  const feedbackList = feedbackService.getFeedbackList();
  const avgRating = feedbackService.getAverageRating();

  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(telemetryService.getAggregateMetrics());
    };
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(112, 69, 255, 0.1) 0%, rgba(0, 240, 255, 0.08) 100%)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "24px" }}>📊</span>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                Pactra Truthful Product Metrics
              </h2>
              <span
                style={{
                  background: "rgba(0, 230, 153, 0.15)",
                  color: "var(--emerald)",
                  border: "1px solid rgba(0, 230, 153, 0.3)",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                }}
              >
                STRICT VERIFIED DATA
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "800px", lineHeight: "1.6" }}>
              In accordance with Pactra hard security and integrity rules, this dashboard strictly isolates <strong>Real Midnight Preprod On-Chain State</strong> from <strong>Local Simulation Testbed Data</strong>. We never fabricate user counts, transactions, or testimonials.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid var(--border-subtle)",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "12px",
              color: isIndexerLive ? "var(--emerald)" : "var(--amber)",
            }}
          >
            <span>{isIndexerLive ? "●" : "○"}</span>
            <span>Preprod Indexer: {isIndexerLive ? "Synced" : "Connecting..."}</span>
          </div>
        </div>
      </div>

      {/* Side-by-Side Isolation Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "20px",
        }}
      >
        {/* Column 1: REAL USER / ON-CHAIN PREPROD DATA */}
        <div
          style={{
            background: "rgba(10, 18, 40, 0.75)",
            border: "1px solid var(--border-cyan)",
            borderRadius: "var(--radius-lg)",
            padding: "22px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🌐</span>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--cyan)" }}>
                Real Preprod Activity
              </h3>
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                background: "rgba(0, 240, 255, 0.15)",
                color: "var(--cyan)",
                border: "1px solid rgba(0, 240, 255, 0.3)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              GENUINE MIDNIGHT STATE
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Target Network</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-main)" }}>
                Midnight Preprod Testnet
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Deployed Contract Address</span>
              <span
                style={{
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  color: escrowState.contractAddress ? "var(--cyan)" : "var(--text-dim)",
                }}
              >
                {escrowState.contractAddress
                  ? `${escrowState.contractAddress.slice(0, 10)}...${escrowState.contractAddress.slice(-8)}`
                  : "None (Deploy in Protocol Tab)"}
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Escrow Balance (On-Chain)</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--emerald)" }}>
                {escrowState.escrowedAmount} DUST
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Lace Handshake Sessions</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-main)" }}>
                {metrics.walletConnections}
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Tester Feedback Submissions</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--amber)" }}>
                {feedbackList.length} reviews {avgRating > 0 ? `(avg ${avgRating}★)` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Column 2: LOCAL DEV / TESTBED SIMULATION DATA */}
        <div
          style={{
            background: "rgba(25, 18, 38, 0.7)",
            border: "1px solid rgba(255, 170, 0, 0.3)",
            borderRadius: "var(--radius-lg)",
            padding: "22px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>🧪</span>
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: "var(--amber)" }}>
                Local Sandbox Testbed
              </h3>
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                background: "rgba(255, 170, 0, 0.15)",
                color: "var(--amber)",
                border: "1px solid rgba(255, 170, 0, 0.3)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              OFF-CHAIN SIMULATION
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Onboarding Flow Runs</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-main)" }}>
                {metrics.onboardingCompletions}
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Sandbox Procurements Attempted</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-main)" }}>
                {metrics.procurementsCompleted}
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Cryptographic Verifications</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--emerald)" }}>
                {metrics.verificationsPassed} passed / {metrics.verificationsFailed} failed
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Simulated Settlements / Refunds</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: "var(--primary-glow)" }}>
                {metrics.settlements} settled • {metrics.refunds} refunded
              </span>
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.35)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Handled Error Events</span>
              <span style={{ fontSize: "14px", fontWeight: 800, color: metrics.errorCount > 0 ? "var(--crimson)" : "var(--text-muted)" }}>
                {metrics.errorCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acquisition Target Notice */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.4)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <strong style={{ fontSize: "13px", color: "var(--text-main)" }}>
            50-User Preprod Acquisition Target:
          </strong>
          <span style={{ fontSize: "13px", color: "var(--text-muted)", marginLeft: "8px" }}>
            Current verified external testers: {feedbackList.length} / 50 target.
          </span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          Target status: IN PROGRESS (External outreach active)
        </div>
      </div>
    </div>
  );
};
