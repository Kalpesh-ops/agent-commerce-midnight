import React, { useState } from "react";
import { EscrowContractData } from "../services/escrowService";
import { TxLifecycleEvent, TxLifecycleStatus } from "../services/contractClient";

interface RoleActionPanelProps {
  data: EscrowContractData;
  isLiveMode: boolean;
  txLifecycle: TxLifecycleEvent | null;
  onDeployContract: () => Promise<void>;
  onJoinContract: (address: string) => Promise<void>;
  onCreateTask: (budget: number) => Promise<void>;
  onFundTask: (amount: number) => Promise<void>;
  onAcceptTask: () => Promise<void>;
  onSubmitCompletion: (evidenceHash: string) => Promise<void>;
  onSettleTask: (payoutAmount: number) => Promise<void>;
  onRefundTask: () => Promise<void>;
  onResetDemo: () => void;
}

export const RoleActionPanel: React.FC<RoleActionPanelProps> = ({
  data,
  isLiveMode,
  txLifecycle,
  onDeployContract,
  onJoinContract,
  onCreateTask,
  onFundTask,
  onAcceptTask,
  onSubmitCompletion,
  onSettleTask,
  onRefundTask,
  onResetDemo,
}) => {
  const [role, setRole] = useState<"creator" | "agent">("creator");
  const [budgetInput, setBudgetInput] = useState<number>(500);
  const [fundInput, setFundInput] = useState<number>(250);
  const [payoutInput, setPayoutInput] = useState<number>(250);
  const [evidenceInput, setEvidenceInput] = useState<string>("0xipfs_result_sha256_output_data_valid");
  const [joinAddressInput, setJoinAddressInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<{ message: string; recovery: string } | null>(null);

  const isBusy = Boolean(
    loading || (txLifecycle && ["PENDING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(txLifecycle.status))
  );

  const handleAction = async (action: () => Promise<void>, actionName: string = "action") => {
    if (isBusy) {
      return;
    }
    setLoading(true);
    setActionError(null);
    try {
      await action();
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      let recovery = "Check that Lace is unlocked and Midnight Preprod Indexer is reachable, then retry.";

      if (/reject|denied|cancel/i.test(errMsg)) {
        recovery = "Transaction authorization was rejected in Lace. Click retry whenever you're ready to proceed.";
      } else if (/insufficient|balance|dust/i.test(errMsg)) {
        recovery = "Your wallet has insufficient DUST for this operation. Request free testnet funds via Nethermind Faucet.";
      } else if (/timeout|timed out/i.test(errMsg)) {
        recovery = "Transaction took longer than expected to confirm. Check Lace activity tab or click Refresh Indexer.";
      } else if (/network|preprod|unsupported/i.test(errMsg)) {
        recovery = "Ensure Lace extension network selector is set to 'Midnight Preprod'.";
      }

      setActionError({
        message: errMsg,
        recovery,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Protocol Actions & Authorization</h3>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            {isLiveMode
              ? "All actions submit genuine Midnight Zero-Knowledge transactions through Lace."
              : "Running in local simulation mode. Connect Lace on Preprod for live deployment."}
          </div>
        </div>
        {!isLiveMode && (
          <button
            className="btn-secondary"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={onResetDemo}
            title="Reset demo simulation"
          >
            Reset Demo
          </button>
        )}
      </div>

      {/* Action Error & Recovery Guidance Box */}
      {actionError && (
        <div
          id="action-error-recovery-card"
          style={{
            background: "rgba(255, 51, 102, 0.12)",
            border: "1px solid var(--crimson)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            marginBottom: "18px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "18px" }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: "var(--crimson)", fontSize: "13px" }}>
                  Action Notice: {actionError.message}
                </div>
                <div style={{ color: "var(--text-main)", marginTop: "4px", fontSize: "12px", lineHeight: "1.4" }}>
                  💡 <strong>Recovery:</strong> {actionError.recovery}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActionError(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Real Transaction Lifecycle Progress Tracker */}
      {txLifecycle && txLifecycle.status !== "IDLE" && (
        <div
          id="tx-lifecycle-tracker"
          style={{
            background:
              txLifecycle.status === "INDEXED" || txLifecycle.status === "CONFIRMED"
                ? "rgba(0, 230, 153, 0.1)"
                : txLifecycle.status === "FAILED"
                ? "rgba(255, 51, 102, 0.12)"
                : "rgba(112, 69, 255, 0.15)",
            border: `1px solid ${
              txLifecycle.status === "INDEXED" || txLifecycle.status === "CONFIRMED"
                ? "var(--emerald)"
                : txLifecycle.status === "FAILED"
                ? "var(--crimson)"
                : "var(--border-glow)"
            }`,
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            marginBottom: "18px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "11px", letterSpacing: "0.5px" }}>
              Midnight Transaction Lifecycle: <span style={{ color: txLifecycle.status === "FAILED" ? "var(--crimson)" : "var(--cyan)" }}>{txLifecycle.status}</span>
            </span>
            {isBusy && <span className="network-indicator-dot"></span>}
          </div>

          {/* Stepper progression bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginBottom: "10px",
              overflowX: "auto",
              paddingBottom: "4px",
            }}
          >
            {(
              [
                "READY",
                "WALLET_REQUIRED",
                "USER_SIGNATURE_REQUIRED",
                "SUBMITTED",
                "CONFIRMING",
                "CONFIRMED",
                "INDEXED",
              ] as const
            ).map((stage, idx) => {
              const stages = [
                "READY",
                "WALLET_REQUIRED",
                "USER_SIGNATURE_REQUIRED",
                "SUBMITTED",
                "CONFIRMING",
                "CONFIRMED",
                "INDEXED",
              ];
              const currentStatus = txLifecycle.status === "PENDING_USER_SIGNATURE" ? "USER_SIGNATURE_REQUIRED" : txLifecycle.status;
              const currentIdx = stages.indexOf(currentStatus as any);
              const isCurrent = currentStatus === stage;
              const isPassed = currentIdx !== -1 && idx < currentIdx;

              return (
                <React.Fragment key={stage}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      background: isCurrent
                        ? "rgba(0, 229, 255, 0.25)"
                        : isPassed
                        ? "rgba(0, 230, 153, 0.2)"
                        : "rgba(255, 255, 255, 0.05)",
                      border: `1px solid ${
                        isCurrent
                          ? "var(--cyan)"
                          : isPassed
                          ? "var(--emerald)"
                          : "rgba(255, 255, 255, 0.1)"
                      }`,
                      color: isCurrent
                        ? "var(--cyan)"
                        : isPassed
                        ? "var(--emerald)"
                        : "var(--text-muted)",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "9px",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isPassed ? "✓ " : isCurrent ? "● " : ""}{stage}
                  </div>
                  {idx < stages.length - 1 && (
                    <span style={{ color: isPassed ? "var(--emerald)" : "var(--text-muted)", fontSize: "9px" }}>
                      →
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <p style={{ color: "var(--text-main)", marginBottom: "4px" }}>{txLifecycle.message}</p>
          {txLifecycle.txHash && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--emerald)" }}>
              Tx ID: {txLifecycle.txHash}
            </div>
          )}
          {txLifecycle.blockHeight && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Confirmed in Block #{txLifecycle.blockHeight}
            </div>
          )}
        </div>
      )}

      {/* Contract Deployment & Joining controls if not deployed */}
      {isLiveMode && !data.contractAddress && (
        <div style={{ background: "rgba(0, 0, 0, 0.25)", padding: "16px", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
          <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>On-Chain Preprod Contract Setup</h4>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "14px" }}>
            No contract is active yet. Deploy a new TaskEscrow contract to Midnight Preprod (requires Lace signature & testnet tNight), or join an existing contract address.
          </p>

          <button
            id="btn-deploy-preprod"
            className="btn-action primary"
            style={{ width: "100%", marginBottom: "12px" }}
            disabled={isBusy}
            onClick={() => handleAction(onDeployContract)}
          >
            {isBusy ? "Awaiting Lace Deployment..." : "🚀 Deploy TaskEscrow to Midnight Preprod"}
          </button>

          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <input
              type="text"
              placeholder="Paste existing contract address (0x...)"
              className="form-input"
              value={joinAddressInput}
              onChange={(e) => setJoinAddressInput(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-secondary"
              disabled={isBusy || !joinAddressInput}
              onClick={() => handleAction(() => onJoinContract(joinAddressInput))}
            >
              Join
            </button>
          </div>
        </div>
      )}

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
                disabled={isBusy || budgetInput <= 0}
                onClick={() => handleAction(() => onCreateTask(budgetInput))}
              >
                {isBusy ? "Submitting to Network..." : "1. Initialize Task Escrow (createTask)"}
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
                  isBusy ||
                  fundInput <= 0 ||
                  data.escrowedAmount + fundInput > data.maxBudget
                }
                onClick={() => handleAction(() => onFundTask(fundInput))}
              >
                {isBusy ? "Submitting Deposit..." : "2. Fund Escrow Balance (fundTask)"}
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
                disabled={isBusy || payoutInput <= 0 || payoutInput > data.escrowedAmount}
                onClick={() => handleAction(() => onSettleTask(payoutInput))}
              >
                {isBusy ? "Releasing Payout..." : "5. Verify Conditions & Release Settlement (settleTask)"}
              </button>
            </div>
          )}

          {["CREATED", "FUNDED", "ACTIVE", "COMPLETION_PENDING"].includes(data.taskState) && (
            <div style={{ marginTop: "20px" }}>
              <button
                id="btn-refund-task"
                className="btn-action danger"
                style={{ width: "100%" }}
                disabled={isBusy}
                onClick={() => handleAction(onRefundTask)}
              >
                {isBusy ? "Processing..." : "Claim Refund (refundTask)"}
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
                disabled={isBusy}
                onClick={() => handleAction(onAcceptTask)}
              >
                {isBusy ? "Proving Authorization..." : "3. Accept & Begin Task (acceptTask)"}
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
                disabled={isBusy || !evidenceInput}
                onClick={() => handleAction(() => onSubmitCompletion(evidenceInput))}
              >
                {isBusy ? "Submitting Evidence..." : "4. Submit Completion Evidence (submitCompletion)"}
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
