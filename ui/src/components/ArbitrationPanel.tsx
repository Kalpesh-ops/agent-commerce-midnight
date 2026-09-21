import React, { useState } from "react";
import {
  pactraUiService,
  PactraProtocolState,
} from "../services/pactraUiService";
import {
  Arbitrator,
  MultiPartyDispute,
  ArbitrationVerdict,
} from "../../../contract/src/index.js";

interface ArbitrationPanelProps {
  onLog: (text: string, type?: "info" | "success" | "error") => void;
}

export const ArbitrationPanel: React.FC<ArbitrationPanelProps> = ({ onLog }) => {
  const [pactraState, setPactraState] = useState<PactraProtocolState>(
    pactraUiService.getState()
  );
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedArbitratorId, setSelectedArbitratorId] = useState<string>(
    "arb_oracle_node_01"
  );
  const [selectedVerdict, setSelectedVerdict] = useState<ArbitrationVerdict>(
    "REFUND_CREATOR"
  );
  const [rationaleInput, setRationaleInput] = useState<string>(
    "Service failed cryptographic SLA verification; telemetry indicates timeout."
  );
  const [claimantInput, setClaimantInput] = useState<"CREATOR" | "PROVIDER" | "AUTOMATED_VERIFIER">(
    "CREATOR"
  );
  const [disputeReasonInput, setDisputeReasonInput] = useState<string>(
    "Output data hash did not match objective condition commitment."
  );

  const refreshState = () => {
    setPactraState(pactraUiService.getState());
  };

  const handleOpenDispute = () => {
    const latestProcurement = pactraState.activeProcurements[0];
    const procurementId = latestProcurement?.procurementId || "proc_manual_dispute_01";
    try {
      onLog(`Opening formal dispute for procurement ${procurementId}...`, "info");
      const dispute = pactraUiService.openArbitrationDispute({
        procurementId,
        claimant: claimantInput,
        reason: disputeReasonInput,
        amount: 2n,
      });
      setSelectedDisputeId(dispute.disputeId);
      refreshState();
      onLog(
        `Dispute registered: ${dispute.disputeId}. Escalated to 2-of-3 threshold arbitration board.`,
        "success"
      );
    } catch (err: any) {
      onLog(`Failed to open dispute: ${err.message}`, "error");
    }
  };

  const handleCastVote = () => {
    if (!selectedDisputeId) {
      onLog("Please select an active dispute to vote on.", "error");
      return;
    }
    try {
      onLog(
        `Arbitrator ${selectedArbitratorId} casting vote "${selectedVerdict}" on dispute ${selectedDisputeId}...`,
        "info"
      );
      const res = pactraUiService.castArbitrationVote(
        selectedDisputeId,
        selectedArbitratorId,
        selectedVerdict,
        rationaleInput
      );
      refreshState();
      if (res.resolved) {
        onLog(
          `Consensus reached! Dispute ${selectedDisputeId} resolved with verdict: ${res.status}.`,
          "success"
        );
      } else {
        onLog(
          `Vote recorded! Threshold not yet reached (${res.dispute.votes.size}/${res.dispute.requiredThreshold}).`,
          "info"
        );
      }
    } catch (err: any) {
      onLog(`Vote error: ${err.message}`, "error");
    }
  };

  const activeDisputes = pactraState.arbitrationDisputes;
  const currentDispute = activeDisputes.find((d) => d.disputeId === selectedDisputeId) || activeDisputes[0];

  return (
    <div className="panel-card" style={{ marginTop: "24px" }}>
      <div className="panel-header">
        <div>
          <h3>⚖️ Multi-Party Threshold Arbitration Board</h3>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Decentralized dispute resolution for subjective tasks and SLA failures via M-of-N threshold consensus.
          </div>
        </div>
      </div>

      {/* Arbitrator Board Seats */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--cyan)", marginBottom: "10px" }}>
          Registered Board Arbitrators (2-of-3 Threshold Consensus):
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" }}>
          {pactraState.arbitrators.map((arb: Arbitrator) => (
            <div
              key={arb.arbitratorId}
              style={{
                background: "rgba(10, 10, 25, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-sm)",
                padding: "12px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main)" }}>
                  {arb.isHuman ? "👤 Human Panel" : "🤖 SLA Oracle"}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--emerald)",
                    background: "rgba(0, 230, 153, 0.15)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  Rep: {arb.reputationScore}/100
                </span>
              </div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>
                {arb.name}
              </div>
              <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                PK: {arb.publicKeyCommitment.slice(0, 20)}...
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trigger New Dispute Section */}
      <div
        style={{
          background: "rgba(255, 51, 102, 0.06)",
          border: "1px solid rgba(255, 51, 102, 0.2)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <h4 style={{ fontSize: "13px", color: "var(--crimson)", marginBottom: "8px" }}>
          Escalate Execution Failure to Arbitration
        </h4>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "10px", alignItems: "center" }}>
          <div>
            <label className="form-label" style={{ fontSize: "11px" }}>Claimant</label>
            <select
              className="form-input"
              value={claimantInput}
              onChange={(e) => setClaimantInput(e.target.value as any)}
              style={{ fontSize: "12px" }}
            >
              <option value="CREATOR">Task Creator</option>
              <option value="PROVIDER">Service Provider</option>
              <option value="AUTOMATED_VERIFIER">Automated Verifier</option>
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: "11px" }}>Dispute Rationale</label>
            <input
              type="text"
              className="form-input"
              value={disputeReasonInput}
              onChange={(e) => setDisputeReasonInput(e.target.value)}
              style={{ fontSize: "12px" }}
            />
          </div>

          <button
            className="btn-action danger"
            style={{ marginTop: "16px", padding: "8px 16px", fontSize: "12px" }}
            onClick={handleOpenDispute}
          >
            Open Dispute
          </button>
        </div>
      </div>

      {/* Active Disputes & Voting Console */}
      {currentDispute && (
        <div
          style={{
            background: "rgba(0, 0, 0, 0.25)",
            border: "1px solid var(--border-glow)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--cyan)" }}>
                Active Case: {currentDispute.disputeId}
              </span>
              <span
                style={{
                  marginLeft: "10px",
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontWeight: 700,
                  background:
                    currentDispute.status.startsWith("RESOLVED")
                      ? "rgba(0, 230, 153, 0.15)"
                      : "rgba(255, 170, 0, 0.15)",
                  color:
                    currentDispute.status.startsWith("RESOLVED")
                      ? "var(--emerald)"
                      : "var(--amber)",
                }}
              >
                {currentDispute.status}
              </span>
            </div>

            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Votes Cast: {currentDispute.votes.size} / {currentDispute.requiredThreshold} Required
            </div>
          </div>

          <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "14px" }}>
            Claimant: <strong>{currentDispute.claimant}</strong> | Reason: <em>"{currentDispute.reason}"</em>
          </p>

          {currentDispute.status === "PENDING_ARBITRATION" && (
            <div style={{ background: "rgba(10, 10, 20, 0.5)", padding: "12px", borderRadius: "var(--radius-sm)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>
                Cast Arbitrator Verdict:
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr auto", gap: "8px", alignItems: "center" }}>
                <select
                  className="form-input"
                  value={selectedArbitratorId}
                  onChange={(e) => setSelectedArbitratorId(e.target.value)}
                  style={{ fontSize: "11px" }}
                >
                  {pactraState.arbitrators.map((a) => (
                    <option key={a.arbitratorId} value={a.arbitratorId}>
                      {a.name}
                    </option>
                  ))}
                </select>

                <select
                  className="form-input"
                  value={selectedVerdict}
                  onChange={(e) => setSelectedVerdict(e.target.value as any)}
                  style={{ fontSize: "11px" }}
                >
                  <option value="REFUND_CREATOR">REFUND_CREATOR</option>
                  <option value="UPHOLD_SETTLEMENT">UPHOLD_SETTLEMENT</option>
                  <option value="SPLIT_PENALTY">SPLIT_PENALTY</option>
                </select>

                <input
                  type="text"
                  className="form-input"
                  value={rationaleInput}
                  onChange={(e) => setRationaleInput(e.target.value)}
                  style={{ fontSize: "11px" }}
                />

                <button
                  className="btn-action primary"
                  style={{ padding: "6px 14px", fontSize: "11px" }}
                  onClick={handleCastVote}
                >
                  Cast Vote
                </button>
              </div>
            </div>
          )}

          {currentDispute.resolutionSummary && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "var(--radius-sm)",
                background: "rgba(0, 230, 153, 0.1)",
                border: "1px solid var(--emerald)",
                fontSize: "12px",
                color: "var(--emerald)",
              }}
            >
              <strong>Resolution Summary:</strong> {currentDispute.resolutionSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
