import React, { useState, useEffect } from "react";
import { ProductionHealthMonitor, SystemHealthReport } from "../../../contract/src/pactra/health/healthMonitor";
import { UiEnvironmentConfig } from "../config/network";

interface SystemHealthPanelProps {
  currentEnv: UiEnvironmentConfig;
  isWalletConnected: boolean;
  walletNetwork?: string | null;
  activeContractAddress?: string | null;
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
  currentEnv,
  isWalletConnected,
  walletNetwork,
  activeContractAddress,
}) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(false);

  const monitor = new ProductionHealthMonitor();

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await monitor.evaluateSystemHealth({
        isWalletConnected,
        walletNetwork,
        indexerUrl: currentEnv.indexerUrl,
        contractAddress: activeContractAddress || currentEnv.defaultContractAddress,
        proverUrl: currentEnv.id === "PREPROD" ? "https://prover.preprod.midnight.network" : null,
        activeRuntimeTasks: 1,
      });
      setReport(result);
    } catch (err) {
      console.error("Health diagnostics failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [isWalletConnected, walletNetwork, currentEnv.id, activeContractAddress]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return "#10b981"; // green
      case "DEGRADED":
        return "#f59e0b"; // amber
      case "DOWN":
      case "CRITICAL":
        return "#ef4444"; // red
      default:
        return "#94a3b8"; // slate
    }
  };

  return (
    <div
      style={{
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "16px",
        padding: "24px",
        color: "#f8fafc",
        marginTop: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", fontWeight: 700 }}>
            🛰️ System & Subsystem Health Diagnostics
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>
            Real-time status monitoring across Midnight network infrastructure, contract state, and agent runtime.
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          style={{
            background: "rgba(168, 85, 247, 0.2)",
            border: "1px solid rgba(168, 85, 247, 0.4)",
            color: "#c084fc",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: loading ? "wait" : "pointer",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          {loading ? "Diagnosing..." : "🔄 Refresh Status"}
        </button>
      </div>

      {report && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {/* Subsystem 1: Wallet */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>👛 Midnight Lace Wallet</span>
              <span style={{ ...badgeStyle, color: getStatusColor(report.wallet.status) }}>
                ● {report.wallet.status}
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>{report.wallet.message}</p>
          </div>

          {/* Subsystem 2: Indexer */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>📊 Midnight GraphQL Indexer</span>
              <span style={{ ...badgeStyle, color: getStatusColor(report.indexer.status) }}>
                ● {report.indexer.status}
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: "0 0 6px 0" }}>{report.indexer.message}</p>
            {report.indexer.latencyMs && (
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Latency: {report.indexer.latencyMs}ms</span>
            )}
          </div>

          {/* Subsystem 3: Contract */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>📜 Compact Smart Contract</span>
              <span style={{ ...badgeStyle, color: getStatusColor(report.contract.status) }}>
                ● {report.contract.status}
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>{report.contract.message}</p>
          </div>

          {/* Subsystem 4: Proof Server */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>🛡️ Midnight Proof Server</span>
              <span style={{ ...badgeStyle, color: getStatusColor(report.proofServer.status) }}>
                ● {report.proofServer.status}
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>{report.proofServer.message}</p>
          </div>

          {/* Subsystem 5: Agent Runtime */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>🤖 Autonomous Agent Runtime</span>
              <span style={{ ...badgeStyle, color: getStatusColor(report.agentRuntime.status) }}>
                ● {report.agentRuntime.status}
              </span>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#cbd5e1", margin: 0 }}>{report.agentRuntime.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const cardStyle: React.CSSProperties = {
  background: "rgba(30, 41, 59, 0.5)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "12px",
  padding: "16px",
};

const badgeStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
};
