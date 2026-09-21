import React, { useState } from "react";
import {
  pactraUiService,
  PactraLevel2State,
} from "../services/pactraUiService";
import { PlannedAction } from "../../../contract/src/index.js";

interface AgentAuthorityPanelProps {
  onLog: (text: string, type?: "info" | "success" | "error") => void;
  onMidnightSettle?: () => Promise<void>;
  isMidnightBusy?: boolean;
}

export const AgentAuthorityPanel: React.FC<AgentAuthorityPanelProps> = ({
  onLog,
  onMidnightSettle,
  isMidnightBusy,
}) => {
  const [pactraState, setPactraState] = useState<PactraLevel2State>(
    pactraUiService.getState()
  );
  const [userPrompt, setUserPrompt] = useState<string>(
    "Deploy my application and keep it running for 24 hours."
  );
  const [activeProcurementId, setActiveProcurementId] = useState<string | null>(
    null
  );
  const [simulating, setSimulating] = useState<boolean>(false);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  const refreshState = () => {
    setPactraState(pactraUiService.getState());
  };

  const handleGeneratePlan = () => {
    try {
      const plan = pactraUiService.planObjective(userPrompt);
      refreshState();
      onLog(
        `Agent Task Planner synthesized ${plan.actions.length} structured actions for: "${userPrompt.slice(0, 40)}..."`,
        "info"
      );
    } catch (err: any) {
      onLog(`Planner error: ${err.message}`, "error");
    }
  };

  const handleProcureCompute = async () => {
    setSimulating(true);
    try {
      onLog(
        "Agent requesting micro-procurement for Compute Job (srv_compute_alpha)...",
        "info"
      );
      const record = await pactraUiService.procureComputeJob({
        jobId: `job_${Date.now().toString(36)}`,
        serviceId: "srv_compute_alpha",
        instructions: "Execute secure compute matrix operation",
        maxDurationSeconds: 15,
      });
      setActiveProcurementId(record.procurementId);
      refreshState();
      const authId = record.authToken?.authorizationId ?? "auth_pre_approved";
      onLog(
        `Policy check passed! Authorized token: ${authId}. Status: ${record.status}`,
        "success"
      );
    } catch (err: any) {
      onLog(`Procurement blocked by policy: ${err.message}`, "error");
    } finally {
      setSimulating(false);
    }
  };

  const handleExecuteCompute = async (
    failureMode?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE"
  ) => {
    if (!activeProcurementId) return;
    setSimulating(true);
    try {
      if (failureMode) {
        onLog(`Simulating provider failure mode: ${failureMode}...`, "info");
      } else {
        onLog(
          `Provider executing compute job for procurement ${activeProcurementId}...`,
          "info"
        );
      }
      const evidence = await pactraUiService.executeProcurement(
        activeProcurementId,
        failureMode
      );
      refreshState();
      onLog(
        `Execution evidence received! Output Hash: ${evidence.outputHash.slice(0, 18)}... Duration: ${(((evidence.executionDurationMs ?? 0) / 1000)).toFixed(1)}s`,
        "success"
      );
    } catch (err: any) {
      refreshState();
      onLog(`Compute execution failed: ${err.message}`, "error");
    } finally {
      setSimulating(false);
    }
  };

  const handleVerifyEvidence = (corruptCondition: boolean = false) => {
    if (!pactraState.latestEvidence) {
      onLog("No execution evidence available to verify.", "error");
      return;
    }
    try {
      const res = pactraUiService.verifyCompletion(
        pactraState.latestEvidence,
        corruptCondition
      );
      refreshState();
      if (res.verified) {
        onLog(
          `Objective completion conditions VERIFIED! Condition Commitment: ${res.conditionCommitment.slice(0, 16)}...`,
          "success"
        );
      } else {
        onLog(
          `Verification FAILED: ${res.failureReason || "Condition mismatch."}`,
          "error"
        );
      }
    } catch (err: any) {
      onLog(`Verification exception: ${err.message}`, "error");
    }
  };

  const handleDispute = () => {
    if (!activeProcurementId) return;
    try {
      const dispute = pactraUiService.disputeProcurement(
        activeProcurementId,
        "Execution evidence failed cryptographic condition check."
      );
      refreshState();
      onLog(
        `Dispute registered: ${dispute.disputeId}. Reserved escrow funds released back.`,
        "error"
      );
    } catch (err: any) {
      onLog(`Dispute error: ${err.message}`, "error");
    }
  };

  const handleTestForbiddenAction = () => {
    try {
      pactraUiService.testForbiddenWalletAction("sendTransaction(treasury, 50 DUST)");
      setSecurityNotice(null);
    } catch (err: any) {
      setSecurityNotice(err.message);
      onLog(`SECURITY GUARD TRIGGERED: ${err.message}`, "error");
    }
  };

  const budget = pactraState.budgetSnapshot;

  return (
    <div className="panel-card" style={{ marginTop: "24px" }}>
      <div className="panel-header">
        <div>
          <h3>🛡️ Pactra Level 2: Agent Authority & Micro-Procurement Engine</h3>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Bounded economic autonomy enforced by cryptographically anchored Task Policies.
          </div>
        </div>
      </div>

      {/* Visual Agent Authority Panel */}
      <div
        id="agent-authority-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          background: "rgba(112, 69, 255, 0.08)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Budget Allocation
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--cyan)", marginTop: "4px" }}>
            ${budget.taskEscrowAllocation.toString()} <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>DUST</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            User Treasury: ${budget.userTreasuryTotal.toString()}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Per-Tx Spend Limit
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--emerald)", marginTop: "4px" }}>
            ${budget.perTransactionLimit.toString()} <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>DUST</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Max per procurement
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Approved Services
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)", marginTop: "4px" }}>
            {pactraState.registryServices.length}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Allowlisted in policy
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Capabilities
          </div>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
            {pactraState.policy.allowedCapabilities.map((cap: string) => (
              <span
                key={cap}
                style={{
                  background: "rgba(0, 230, 153, 0.15)",
                  color: "var(--emerald)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: "11px", color: "var(--crimson)", textTransform: "uppercase", fontWeight: 700 }}>
            Treasury Access
          </div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--crimson)", marginTop: "4px" }}>
            STRICTLY NONE
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Zero raw transfer rights
          </div>
        </div>
      </div>

      {/* Security Invariant Test Trigger */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(255, 51, 102, 0.08)",
          border: "1px solid rgba(255, 51, 102, 0.3)",
          borderRadius: "var(--radius-md)",
          padding: "10px 14px",
          marginBottom: "20px",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--crimson)" }}>
            Security Test: Attempt Unauthorized Treasury Action
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Verify that agent cannot execute raw sendTransaction() or drain treasury.
          </div>
        </div>
        <button
          className="btn-secondary"
          style={{ borderColor: "var(--crimson)", color: "var(--crimson)", fontSize: "11px", padding: "6px 12px" }}
          onClick={handleTestForbiddenAction}
        >
          🚨 Trigger sendTransaction() Test
        </button>
      </div>

      {securityNotice && (
        <div
          style={{
            background: "rgba(255, 51, 102, 0.15)",
            border: "1px solid var(--crimson)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "12px",
            color: "var(--crimson)",
            marginBottom: "20px",
          }}
        >
          <strong>Policy Enforcer Blocked Action:</strong> {securityNotice}
        </div>
      )}

      {/* Section 1: Agent Task Planner */}
      <div style={{ background: "rgba(0, 0, 0, 0.2)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "20px" }}>
        <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>🤖 Step 1: Deterministic Agent Task Planner</h4>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Input an autonomous objective. The planner produces structured machine-readable actions mapped to policy capabilities.
        </p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input
            type="text"
            className="form-input"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn-action primary" onClick={handleGeneratePlan} style={{ whiteSpace: "nowrap" }}>
            Generate Structured Plan
          </button>
        </div>

        {pactraState.activePlan && (
          <div style={{ background: "rgba(10, 10, 20, 0.6)", borderRadius: "var(--radius-sm)", padding: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--cyan)", marginBottom: "8px" }}>
              Action Graph Plan ({pactraState.activePlan.actions.length} Steps):
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pactraState.activePlan.actions.map((act: PlannedAction) => (
                <div
                  key={act.actionId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "12px",
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: "6px 10px",
                    borderRadius: "4px",
                  }}
                >
                  <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>#{act.step}</span>
                  <span
                    style={{
                      background: "rgba(112, 69, 255, 0.2)",
                      color: "var(--purple)",
                      padding: "1px 6px",
                      borderRadius: "3px",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {act.capability}
                  </span>
                  <span style={{ flex: 1, color: "var(--text-main)" }}>{act.name}: {act.description}</span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Category: {act.serviceCategory}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Concrete Micro-Procurement Flow */}
      <div style={{ background: "rgba(0, 0, 0, 0.2)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "20px" }}>
        <h4 style={{ fontSize: "14px", marginBottom: "8px" }}>⚡ Step 2: Micro-Procurement Flow (COMPUTE JOB)</h4>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
          Target Service: <strong>Compute Worker Alpha</strong> (Price: 2 DUST). The procurement engine validates policy bounds before allocating funds.
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
          <button
            className="btn-action primary"
            disabled={simulating}
            onClick={handleProcureCompute}
          >
            1. Request & Authorize Compute Job
          </button>

          <button
            className="btn-action cyan"
            disabled={simulating || !activeProcurementId}
            onClick={() => handleExecuteCompute()}
          >
            2. Execute Job (Provider Evidence)
          </button>

          <button
            className="btn-action emerald"
            disabled={simulating || !pactraState.latestEvidence}
            onClick={() => handleVerifyEvidence(false)}
          >
            3. Verify Objective Conditions
          </button>

          {onMidnightSettle && (
            <button
              className="btn-action emerald"
              style={{ background: "linear-gradient(135deg, #00e699 0%, #00b377 100%)" }}
              disabled={simulating || isMidnightBusy || !pactraState.verificationResult?.verified}
              onClick={onMidnightSettle}
            >
              4. Settle on Midnight Circuit
            </button>
          )}
        </div>

        {/* Failure & Dispute simulation buttons */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
          <span style={{ fontSize: "11px", color: "var(--text-muted)", alignSelf: "center", marginRight: "4px" }}>
            Simulate Edge Paths:
          </span>
          <button
            className="btn-secondary"
            style={{ fontSize: "11px", padding: "4px 8px" }}
            disabled={simulating || !activeProcurementId}
            onClick={() => handleExecuteCompute("REJECTED")}
          >
            Simulate Provider Rejection
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: "11px", padding: "4px 8px" }}
            disabled={simulating || !activeProcurementId}
            onClick={() => handleExecuteCompute("INVALID_EVIDENCE")}
          >
            Simulate Corrupted Output
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: "11px", padding: "4px 8px" }}
            disabled={simulating || !pactraState.latestEvidence}
            onClick={() => handleVerifyEvidence(true)}
          >
            Simulate Verification Failure
          </button>
          <button
            className="btn-secondary"
            style={{ fontSize: "11px", padding: "4px 8px", color: "var(--crimson)", borderColor: "var(--crimson)" }}
            disabled={simulating || !activeProcurementId}
            onClick={handleDispute}
          >
            Raise Dispute & Refund
          </button>
        </div>

        {/* Evidence Inspector */}
        {pactraState.latestEvidence && (
          <div style={{ marginTop: "14px", background: "rgba(10, 10, 20, 0.6)", borderRadius: "var(--radius-sm)", padding: "12px" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--emerald)", marginBottom: "6px" }}>
              📄 Execution Evidence Snapshot:
            </div>
            <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
              <div>Job ID: {pactraState.latestEvidence.jobId}</div>
              <div>Provider: {pactraState.latestEvidence.providerCommitment}</div>
              <div>Output Hash: {pactraState.latestEvidence.outputHash}</div>
              <div>Duration: {(((pactraState.latestEvidence.executionDurationMs ?? 0) / 1000)).toFixed(1)}s</div>
              <div>Cost Incurred: {pactraState.latestEvidence.costIncurred.toString()} DUST</div>
            </div>
          </div>
        )}

        {/* Verification Inspector */}
        {pactraState.verificationResult && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              borderRadius: "var(--radius-sm)",
              background: pactraState.verificationResult.verified ? "rgba(0, 230, 153, 0.1)" : "rgba(255, 51, 102, 0.1)",
              border: `1px solid ${pactraState.verificationResult.verified ? "var(--emerald)" : "var(--crimson)"}`,
              fontSize: "12px",
            }}
          >
            <strong>
              {pactraState.verificationResult.verified ? "✅ Verification PASSED" : "❌ Verification FAILED"}
            </strong>
            {pactraState.verificationResult.failureReason && (
              <div style={{ marginTop: "4px", color: "var(--crimson)" }}>
                {pactraState.verificationResult.failureReason}
              </div>
            )}
          </div>
        )}

        {/* Dispute Inspector */}
        {pactraState.dispute && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(255, 51, 102, 0.15)",
              border: "1px solid var(--crimson)",
              fontSize: "12px",
              color: "var(--crimson)",
            }}
          >
            <strong>⚠️ Active Dispute: {pactraState.dispute.disputeId}</strong>
            <div>Reason: {pactraState.dispute.reason}</div>
            <div>Status: {pactraState.dispute.resolvedState} (Escrow allocation released)</div>
          </div>
        )}
      </div>

      {/* Midnight City Runtime Heartbeat */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(0, 204, 255, 0.05)",
          border: "1px solid rgba(0, 204, 255, 0.2)",
          borderRadius: "var(--radius-md)",
          padding: "12px 16px",
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: "12px", color: "var(--cyan)" }}>
            🏙️ Midnight City Agent Adapter Status: REGISTERED & ACTIVE
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
            Decoupled external agent runtime ready for autonomous city simulation.
          </div>
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: "11px", padding: "6px 12px" }}
          onClick={() => {
            const evt = pactraUiService.dispatchCityHeartbeat();
            refreshState();
            onLog(evt, "info");
          }}
        >
          Send City Heartbeat
        </button>
      </div>
    </div>
  );
};
