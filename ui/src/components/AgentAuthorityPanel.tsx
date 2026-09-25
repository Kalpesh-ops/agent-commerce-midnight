import React, { useRef, useState } from "react";
import { pactraUiService, PactraLevel2State } from "../services/pactraUiService";
import { PlannedAction } from "../../../contract/src/index.js";
import { Hash, LogFn, Mark, PageHead, Tag, useSingleFlight } from "./ui";

interface AgentAuthorityPanelProps {
  onLog: LogFn;
  onMidnightSettle?: () => Promise<void>;
  isMidnightBusy?: boolean;
}

export const AgentAuthorityPanel: React.FC<AgentAuthorityPanelProps> = ({ onLog, onMidnightSettle, isMidnightBusy }) => {
  const [pactraState, setPactraState] = useState<PactraLevel2State>(pactraUiService.getState());
  const [userPrompt, setUserPrompt] = useState<string>("Deploy my application and keep it running for 24 hours.");
  const [activeProcurementId, setActiveProcurementId] = useState<string | null>(null);
  // Where the current purchase is. Each button is only live at the stage it belongs to.
  type Stage = "idle" | "requested" | "ran" | "verified" | "failed" | "disputed";
  const [stage, setStageState] = useState<Stage>("idle");
  // Mirror in a ref so synchronous handlers see the latest stage even on a double click.
  const stageRef = useRef<Stage>("idle");
  const setStage = (s: Stage) => {
    stageRef.current = s;
    setStageState(s);
  };
  const { busy: simulating, run } = useSingleFlight();
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  const refreshState = () => {
    setPactraState(pactraUiService.getState());
  };

  const handleGeneratePlan = () => {
    const objective = userPrompt.trim();
    if (!objective) return;
    try {
      const plan = pactraUiService.planObjective(objective);
      refreshState();
      onLog(`Planner produced ${plan.actions.length} actions for "${userPrompt.slice(0, 40)}".`, "info");
    } catch (err: any) {
      onLog(`Planner error: ${err.message}`, "error");
    }
  };

  const handleProcureCompute = () =>
    run(async () => {
    try {
      const record = await pactraUiService.procureComputeJob({
        jobId: `job_${Date.now().toString(36)}`,
        serviceId: "srv_compute_alpha",
        instructions: "Execute secure compute matrix operation",
        maxDurationSeconds: 15,
      });
      setActiveProcurementId(record.procurementId);
      setStage("requested");
      refreshState();
      onLog(`Policy approved purchase. Token ${record.authToken?.authorizationId ?? "auth_pre_approved"}, status ${record.status}.`, "success");
    } catch (err: any) {
      onLog(`Policy blocked the purchase: ${err.message}`, "error");
    }
    });

  const handleExecuteCompute = (failureMode?: "REJECTED" | "TIMEOUT" | "INVALID_EVIDENCE") =>
    run(async () => {
    if (!activeProcurementId || stageRef.current !== "requested") return;
    try {
      onLog(failureMode ? `Provider will fail with ${failureMode}...` : `Provider running job ${activeProcurementId}...`, "info");
      const evidence = await pactraUiService.executeProcurement(activeProcurementId, failureMode);
      setStage("ran");
      refreshState();
      onLog(
        `Evidence received. Output ${evidence.outputHash.slice(0, 18)}..., ${((evidence.executionDurationMs ?? 0) / 1000).toFixed(1)}s.`,
        "success"
      );
    } catch (err: any) {
      setStage("failed");
      refreshState();
      onLog(`Job failed: ${err.message}`, "error");
    }
    });

  const handleVerifyEvidence = (corruptCondition: boolean = false) => {
    if (!pactraState.latestEvidence || stageRef.current !== "ran") {
      return;
    }
    try {
      const res = pactraUiService.verifyCompletion(pactraState.latestEvidence, corruptCondition);
      setStage(res.verified ? "verified" : "failed");
      refreshState();
      onLog(
        res.verified
          ? `Conditions verified. Commitment ${res.conditionCommitment.slice(0, 16)}...`
          : `Verification failed: ${res.failureReason || "condition mismatch"}`,
        res.verified ? "success" : "error"
      );
    } catch (err: any) {
      onLog(`Verification error: ${err.message}`, "error");
    }
  };

  const handleDispute = () => {
    if (!activeProcurementId || stageRef.current === "disputed" || stageRef.current === "idle") return;
    try {
      const dispute = pactraUiService.disputeProcurement(activeProcurementId, "Execution evidence failed cryptographic condition check.");
      setStage("disputed");
      refreshState();
      onLog(`Dispute ${dispute.disputeId} opened. Reserved funds released.`, "error");
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
      onLog(`Guardrail held: ${err.message}`, "error");
    }
  };

  const budget = pactraState.budgetSnapshot;
  const verified = pactraState.verificationResult?.verified;

  const flow: { n: string; label: string; detail: string; done: boolean; button: React.ReactNode }[] = [
    {
      n: "1",
      label: "Request a compute job",
      detail: "Compute Worker Alpha, 2 DUST. The policy engine checks the ceiling, per purchase limit and category.",
      done: stage !== "idle",
      button: (
        <button
          className="btn btn--sm btn--primary"
          disabled={simulating || stage === "requested" || stage === "ran"}
          onClick={handleProcureCompute}
        >
          {stage === "idle" ? "Request" : "New request"}
        </button>
      ),
    },
    {
      n: "2",
      label: "Provider runs the job",
      detail: "The provider returns signed evidence of the output.",
      done: stage === "ran" || stage === "verified",
      button: (
        <button className="btn btn--sm btn--primary" disabled={simulating || stage !== "requested"} onClick={() => handleExecuteCompute()}>
          Run
        </button>
      ),
    },
    {
      n: "3",
      label: "Verify against the condition",
      detail: "The evidence must match the condition committed in the policy.",
      done: stage === "verified",
      button: (
        <button className="btn btn--sm btn--primary" disabled={simulating || stage !== "ran"} onClick={() => handleVerifyEvidence(false)}>
          Verify
        </button>
      ),
    },
  ];

  if (onMidnightSettle) {
    flow.push({
      n: "4",
      label: "Settle on the Midnight contract",
      detail: "Runs settleTask on your escrow, which is waiting for this evidence.",
      done: false,
      button: (
        <button className="btn btn--sm btn--seal" disabled={simulating || isMidnightBusy || !verified || stage !== "verified"} onClick={onMidnightSettle}>
          Settle
        </button>
      ),
    });
  }

  return (
    <div className="page">
      <PageHead
        num="04"
        section="Agent authority"
        title="What the agent may do, and nothing more."
        lede="An agent works under a task policy: a spending ceiling, a per purchase limit, a list of approved services and capabilities. It has no route to your treasury."
        aside={<Tag tone="warn">Simulation</Tag>}
      />

      <div id="agent-authority-panel" className="strip">
        <div>
          <div className="strip-label">Task allocation</div>
          <div className="figure">
            {budget.taskEscrowAllocation.toString()}
            <span className="figure-unit">DUST</span>
          </div>
          <div className="tiny faint">of {budget.userTreasuryTotal.toString()} in your treasury</div>
        </div>
        <div>
          <div className="strip-label">Per purchase limit</div>
          <div className="figure">
            {budget.perTransactionLimit.toString()}
            <span className="figure-unit">DUST</span>
          </div>
        </div>
        <div>
          <div className="strip-label">Approved services</div>
          <div className="figure">{pactraState.registryServices.length}</div>
        </div>
        <div>
          <div className="strip-label">Treasury access</div>
          <div className="figure c-seal">None</div>
          <div className="tiny faint">no raw transfer rights</div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span className="small muted">Capabilities</span>
        {pactraState.policy.allowedCapabilities.map((cap: string) => (
          <Tag key={cap}>{cap}</Tag>
        ))}
      </div>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">Plan an objective</h2>
          <span className="small muted">The planner turns a sentence into actions the policy understands.</span>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleGeneratePlan();
          }}
        >
          <label htmlFor="objective" className="sr-only">
            Objective
          </label>
          <input
            id="objective"
            type="text"
            className="input"
            value={userPrompt}
            maxLength={280}
            placeholder="Describe what the agent should get done"
            onChange={(e) => setUserPrompt(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={!userPrompt.trim()}>
            Make plan
          </button>
        </form>

        {pactraState.activePlan && (
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>Step</th>
                  <th>Action</th>
                  <th>Capability</th>
                  <th>Service category</th>
                </tr>
              </thead>
              <tbody>
                {pactraState.activePlan.actions.map((act: PlannedAction) => (
                  <tr key={act.actionId}>
                    <td className="hash">{String(act.step).padStart(2, "0")}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{act.name}</div>
                      <div className="small muted">{act.description}</div>
                    </td>
                    <td>
                      <Tag>{act.capability}</Tag>
                    </td>
                    <td className="small muted">{act.serviceCategory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">Make a purchase</h2>
          <span className="small muted">Run the steps in order, or break them on purpose below.</span>
        </div>
        <ol className="setup-list">
          {flow.map((f) => (
            <li key={f.n}>
              <span className="setup-n">{f.n}</span>
              <div>
                <div className="row">
                  <Mark kind={f.done ? "fill" : "empty"} tone={f.done ? "ok" : "faint"} />
                  <strong style={{ fontWeight: 600 }}>{f.label}</strong>
                </div>
                <div className="small muted">{f.detail}</div>
              </div>
              {f.button}
            </li>
          ))}
        </ol>

        <div className="row" style={{ marginTop: 16 }}>
          <span className="small muted">Break it:</span>
          <button className="btn btn--sm btn--quiet" disabled={simulating || stage !== "requested"} onClick={() => handleExecuteCompute("REJECTED")}>
            Provider rejects
          </button>
          <button className="btn btn--sm btn--quiet" disabled={simulating || stage !== "requested"} onClick={() => handleExecuteCompute("INVALID_EVIDENCE")}>
            Corrupted output
          </button>
          <button className="btn btn--sm btn--quiet" disabled={simulating || stage !== "ran"} onClick={() => handleVerifyEvidence(true)}>
            Verification fails
          </button>
          <button
            className="btn btn--sm btn--danger"
            disabled={simulating || stage === "idle" || stage === "disputed" || stage === "verified"}
            onClick={handleDispute}
          >
            Dispute and refund
          </button>
        </div>

        {(pactraState.latestEvidence || pactraState.verificationResult || pactraState.dispute) && (
          <div className="cols-2" style={{ marginTop: 20 }}>
            {pactraState.latestEvidence && (
              <div className="sheet">
                <div className="sheet-head">
                  <h3 className="sub">Evidence</h3>
                </div>
                <div className="sheet-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                  <dl className="kv">
                    <dt>Job</dt>
                    <dd>
                      <Hash value={pactraState.latestEvidence.jobId} />
                    </dd>
                    <dt>Provider</dt>
                    <dd>
                      <Hash value={pactraState.latestEvidence.providerCommitment} />
                    </dd>
                    <dt>Output hash</dt>
                    <dd>
                      <Hash value={pactraState.latestEvidence.outputHash} />
                    </dd>
                    <dt>Duration</dt>
                    <dd>{((pactraState.latestEvidence.executionDurationMs ?? 0) / 1000).toFixed(1)}s</dd>
                    <dt>Cost</dt>
                    <dd>{pactraState.latestEvidence.costIncurred.toString()} DUST</dd>
                  </dl>
                </div>
              </div>
            )}
            <div className="stack">
              {pactraState.verificationResult && (
                <div className={`notice ${pactraState.verificationResult.verified ? "notice--ok" : "notice--bad"}`}>
                  <div className="notice-title">
                    {pactraState.verificationResult.verified ? "Verification passed" : "Verification failed"}
                  </div>
                  {pactraState.verificationResult.failureReason ||
                    "The evidence matches the committed condition. Payment can be released."}
                </div>
              )}
              {pactraState.dispute && (
                <div className="notice notice--bad">
                  <div className="notice-title">Dispute {pactraState.dispute.disputeId}</div>
                  <div>{pactraState.dispute.reason}</div>
                  <div className="small">Status {pactraState.dispute.resolvedState}. The reserved funds were released.</div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">Try to drain the treasury</h2>
        </div>
        <div className="sheet">
          <div className="sheet-body row-between">
            <p className="muted" style={{ maxWidth: "60ch" }}>
              Ask the agent to call <span className="hash">sendTransaction(treasury, 50 DUST)</span> directly. The policy
              enforcer should refuse, because raw transfers are not a capability any agent can hold.
            </p>
            <button className="btn btn--danger" onClick={handleTestForbiddenAction}>
              Attempt transfer
            </button>
          </div>
          {securityNotice && (
            <div className="sheet-foot">
              <div className="row">
                <Mark kind="x" tone="bad" />
                <strong style={{ fontWeight: 600 }}>Blocked.</strong>
                <span>{securityNotice}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section-block">
        <div className="sheet">
          <div className="sheet-body row-between">
            <div>
              <h3 className="sub">Midnight City adapter</h3>
              <p className="small muted">
                Registered. An external agent runtime can drive this policy from the Midnight City simulation.
              </p>
            </div>
            <button
              className="btn btn--sm"
              onClick={() => {
                const evt = pactraUiService.dispatchCityHeartbeat();
                refreshState();
                onLog(evt, "info");
              }}
            >
              Send heartbeat
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
