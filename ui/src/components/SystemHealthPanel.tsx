import React, { useState, useEffect } from "react";
import { ProductionHealthMonitor, SystemHealthReport } from "../../../contract/src/pactra/health/healthMonitor";
import { UiEnvironmentConfig } from "../config/network";
import { Mark, Skeleton, Tag } from "./ui";

interface SystemHealthPanelProps {
  currentEnv: UiEnvironmentConfig;
  isWalletConnected: boolean;
  walletNetwork?: string | null;
  activeContractAddress?: string | null;
}

const SUBSYSTEMS: { key: keyof Pick<SystemHealthReport, "wallet" | "indexer" | "contract" | "proofServer" | "agentRuntime">; name: string }[] = [
  { key: "wallet", name: "Lace wallet" },
  { key: "indexer", name: "GraphQL indexer" },
  { key: "contract", name: "TaskEscrow contract" },
  { key: "proofServer", name: "Proof server" },
  { key: "agentRuntime", name: "Agent runtime" },
];

const tone = (status: string): "ok" | "warn" | "bad" | "plain" =>
  status === "HEALTHY" ? "ok" : status === "DEGRADED" ? "warn" : status === "DOWN" || status === "CRITICAL" ? "bad" : "plain";

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({
  currentEnv,
  isWalletConnected,
  walletNetwork,
  activeContractAddress,
}) => {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const result = await new ProductionHealthMonitor().evaluateSystemHealth({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWalletConnected, walletNetwork, currentEnv.id, activeContractAddress]);

  return (
    <section>
      <div className="section-row">
        <p className="muted">Checked against {currentEnv.label}.</p>
        <button className="btn btn--sm" onClick={runDiagnostics} disabled={loading}>
          {loading ? "Checking..." : "Check again"}
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Subsystem</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {SUBSYSTEMS.map(({ key, name }) => {
              const sub = report?.[key];
              return (
                <tr key={key}>
                  <td style={{ fontWeight: 500, whiteSpace: "nowrap" }}>{name}</td>
                  <td style={{ width: 130 }}>
                    {loading || !sub ? (
                      <Skeleton lines={1} widths={["70px"]} />
                    ) : (
                      <Tag tone={tone(sub.status)}>
                        <Mark kind={sub.status === "HEALTHY" ? "fill" : sub.status === "DEGRADED" ? "half" : "x"} />
                        {sub.status.toLowerCase()}
                      </Tag>
                    )}
                  </td>
                  <td className="small muted">
                    {loading || !sub ? (
                      <Skeleton lines={1} widths={["80%"]} />
                    ) : (
                      <>
                        {sub.message}
                        {"latencyMs" in sub && sub.latencyMs ? <span className="faint"> ({sub.latencyMs} ms)</span> : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
