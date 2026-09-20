import React, { useState } from "react";
import { EscrowContractData } from "../services/escrowService";

interface RoleActionPanelProps {
  data: EscrowContractData;
  onCreateTask: (budget: number) => Promise<void>;
  onFundTask: (amount: number) => Promise<void>;
  onAcceptTask: () => Promise<void>;
  onSubmitCompletion: (evidenceHash: string) => Promise<void>;
  onSettleTask: (payoutAmount: number) => Promise<void>;
  onRefundTask: () => Promise<void>;
  onReset: () => void;
}

export const RoleActionPanel: React.FC<RoleActionPanelProps> = ({
  data,
  onCreateTask,
  onFundTask,
  onAcceptTask,
  onSubmitCompletion,
  onSettleTask,
  onRefundTask,
  onReset,
}) => {
  const [role, setRole] = useState<"creator" | "agent">("creator");
  const [budgetInput, setBudgetInput] = useState<number>(500);
  const [fundInput, setFundInput] = useState<number>(250);
  const [payoutInput, setPayoutInput] = useState<number>(250);
  const [evidenceInput, setEvidenceInput] = useState<string>("0xipfs_result_sha256_output_data_valid");
  const [loading, setLoading] = useState<boolean>(false);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    try {
      await action();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>Protocol Actions & Authorization</h3>
        <button
          className="btn-secondary"
          style={{ padding: "4px 10px", fontSize: "12px" }}
          onClick={onReset}
          title="Reset contract to clean state"
        >
          Reset Demo
        </button>
      </div>

      <div className="tab-switcher">
        <button
          id="tab-creator"
          className={`tab-btn ${role === "creator" ? "active" : ""}`}
          onClick={() => setRole("creator")}
        >
          👤 Task Creator (User)
        </button>
        <button
          id="tab-agent"
          className={`tab-btn ${role === "agent" ? "active" : ""}`}
          onClick={() => setRole("agent")}
        >
          🤖 Autonomous Agent
        </button>
      </div>

      {role === "creator" && (
        <div>
          {data.taskState === "UNINITIALIZED" && (
            <div>
              <div className="form-group">
                <label className="form-label">Maximum Task Budget (Upper Bound Limit)</label>
                <input
                  type="number"
                  className="form-input"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(Number(e.target.value))}
                  min={1}
                />
              </div>
              <button
                id="btn-create-task"
                className="btn-action primary"
                style={{ width: "100%" }}
                disabled={loading || budgetInput <= 0}
                onClick={() => handleAction(() => onCreateTask(budgetInput))}
              >
                {loading ? "Generating ZK Proof..." : "1. Initialize Task Escrow"}
              </button>
            </div>
          )}

          {(data.taskState === "CREATED" || data.taskState === "FUNDED") && (
            <div style={{ marginTop: "14px" }}>
              <div className="form-group">
                <label className="form-label">
                  Deposit to Escrow (Current: {data.escrowedAmount} / Max: {data.maxBudget})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={fundInput}
                  onChange={(e) => setFundInput(Number(e.target.value))}
                  max={data.maxBudget - data.escrowedAmount}
                  min={1}
                />
              </div>
              <button
                id="btn-fund-task"
                className="btn-action cyan"
                style={{ width: "100%" }}
                disabled={
                  loading ||
                  fundInput <= 0 ||
                  data.escrowedAmount + fundInput > data.maxBudget
                }
                onClick={() => handleAction(() => onFundTask(fundInput))}
              >
                {loading ? "Depositing Funds..." : "2. Fund Escrow Balance"}
              </button>
            </div>
          )}

          {data.taskState === "COMPLETION_PENDING" && (
            <div style={{ marginTop: "14px" }}>
              <div className="form-group">
                <label className="form-label">
                  Verified Settlement Payout (Escrowed: {data.escrowedAmount})
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={payoutInput}
                  onChange={(e) => setPayoutInput(Number(e.target.value))}
                  max={data.escrowedAmount}
                  min={1}
                />
              </div>
              <button
                id="btn-settle-task"
                className="btn-action emerald"
                style={{ width: "100%" }}
                disabled={loading || payoutInput <= 0 || payoutInput > data.escrowedAmount}
                onClick={() => handleAction(() => onSettleTask(payoutInput))}
              >
                {loading ? "Settling Payout..." : "5. Verify Conditions & Release Settlement"}
              </button>
            </div>
          )}

          {["CREATED", "FUNDED", "ACTIVE", "COMPLETION_PENDING"].includes(data.taskState) && (
            <div style={{ marginTop: "20px" }}>
              <button
                id="btn-refund-task"
                className="btn-action danger"
                style={{ width: "100%" }}
                disabled={loading}
                onClick={() => handleAction(onRefundTask)}
              >
                {loading ? "Processing..." : "Claim Refund (Cancel / Expire)"}
              </button>
            </div>
          )}

          {(data.taskState === "COMPLETED" || data.taskState === "REFUNDED") && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
              Task is finalized in status: <strong>{data.taskState}</strong>.
            </div>
          )}
        </div>
      )}

      {role === "agent" && (
        <div>
          {data.taskState === "FUNDED" && (
            <div>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
                The task is funded with <strong>{data.escrowedAmount} DUST</strong>. As the authorized agent, you can accept and lock the execution contract.
              </p>
              <button
                id="btn-accept-task"
                className="btn-action primary"
                style={{ width: "100%" }}
                disabled={loading}
                onClick={() => handleAction(onAcceptTask)}
              >
                {loading ? "Proving Authorization..." : "3. Accept & Begin Task"}
              </button>
            </div>
          )}

          {data.taskState === "ACTIVE" && (
            <div>
              <div className="form-group">
                <label className="form-label">Completion Evidence / Result Hash</label>
                <input
                  type="text"
                  className="form-input"
                  value={evidenceInput}
                  onChange={(e) => setEvidenceInput(e.target.value)}
                />
              </div>
              <button
                id="btn-submit-completion"
                className="btn-action cyan"
                style={{ width: "100%" }}
                disabled={loading || !evidenceInput}
                onClick={() => handleAction(() => onSubmitCompletion(evidenceInput))}
              >
                {loading ? "Submitting Evidence..." : "4. Submit Completion Evidence"}
              </button>
            </div>
          )}

          {data.taskState !== "FUNDED" && data.taskState !== "ACTIVE" && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)" }}>
              {data.taskState === "UNINITIALIZED" || data.taskState === "CREATED"
                ? "Waiting for task creator to fund the task."
                : `Agent actions not applicable in current state (${data.taskState}).`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
