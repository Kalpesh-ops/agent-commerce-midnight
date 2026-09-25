import React, { useState } from "react";
import { pactraUiService, PactraProtocolState } from "../services/pactraUiService";
import { Arbitrator, ArbitrationVerdict } from "../../../contract/src/index.js";
import { FieldError, Hash, LogFn, Mark, PageHead, Tag } from "./ui";

interface ArbitrationPanelProps {
  onLog: LogFn;
}

const VERDICT_LABEL: Record<ArbitrationVerdict, string> = {
  REFUND_CREATOR: "Refund the creator",
  UPHOLD_SETTLEMENT: "Pay the provider",
  SPLIT_PENALTY: "Split with penalty",
};

export const ArbitrationPanel: React.FC<ArbitrationPanelProps> = ({ onLog }) => {
  const [pactraState, setPactraState] = useState<PactraProtocolState>(pactraUiService.getState());
  const [selectedDisputeId, setSelectedDisputeId] = useState<string | null>(null);
  const [selectedArbitratorId, setSelectedArbitratorId] = useState<string>("arb_oracle_node_01");
  const [selectedVerdict, setSelectedVerdict] = useState<ArbitrationVerdict>("REFUND_CREATOR");
  const [rationaleInput, setRationaleInput] = useState<string>(
    "Service failed cryptographic SLA verification; telemetry indicates timeout."
  );
  const [claimantInput, setClaimantInput] = useState<"CREATOR" | "PROVIDER" | "AUTOMATED_VERIFIER">("CREATOR");
  const [disputeReasonInput, setDisputeReasonInput] = useState<string>(
    "Output data hash did not match objective condition commitment."
  );

  const refreshState = () => {
    setPactraState(pactraUiService.getState());
  };

  const activeDisputes = pactraState.arbitrationDisputes;
  const currentDispute = activeDisputes.find((d) => d.disputeId === selectedDisputeId) || activeDisputes[0];

  // Opening a case
  const targetProcurementId = pactraState.activeProcurements[0]?.procurementId || "proc_manual_dispute_01";
  const openCaseForTarget = activeDisputes.find(
    (d) => d.procurementId === targetProcurementId && d.status === "PENDING_ARBITRATION"
  );
  const reasonError = disputeReasonInput.trim() === "" ? "Describe what went wrong." : null;

  // Voting
  const votedIds = currentDispute ? new Set(Array.from(currentDispute.votes.keys()) as string[]) : new Set<string>();
  const unvoted = pactraState.arbitrators.filter((a) => !votedIds.has(a.arbitratorId));
  const voter = votedIds.has(selectedArbitratorId) ? unvoted[0]?.arbitratorId ?? "" : selectedArbitratorId;
  const rationaleError = rationaleInput.trim() === "" ? "Give a short reason for the verdict." : null;
  const deadlocked = Boolean(currentDispute && currentDispute.status === "PENDING_ARBITRATION" && unvoted.length === 0);

  const handleOpenDispute = () => {
    // One open case per purchase; a second would let the same funds be decided twice.
    // Read live service state so a fast double click cannot pass on a stale render.
    const alreadyOpen = pactraUiService
      .getState()
      .arbitrationDisputes.some((d) => d.procurementId === targetProcurementId && d.status === "PENDING_ARBITRATION");
    if (reasonError || alreadyOpen) return;
    try {
      const dispute = pactraUiService.openArbitrationDispute({
        procurementId: targetProcurementId,
        claimant: claimantInput,
        reason: disputeReasonInput.trim(),
        amount: 2n,
      });
      setSelectedDisputeId(dispute.disputeId);
      setSelectedArbitratorId(pactraState.arbitrators[0]?.arbitratorId ?? "");
      refreshState();
      onLog(`Case ${dispute.disputeId} opened for ${targetProcurementId}. Sent to the 2 of 3 board.`, "success");
    } catch (err: any) {
      onLog(`Could not open the case: ${err.message}`, "error");
    }
  };

  const handleCastVote = () => {
    const disputeId = currentDispute?.disputeId;
    if (!disputeId || !voter || rationaleError) return;
    const live = pactraUiService.getState().arbitrationDisputes.find((d) => d.disputeId === disputeId);
    if (!live || live.status !== "PENDING_ARBITRATION" || live.votes.has(voter)) return;
    try {
      const res = pactraUiService.castArbitrationVote(disputeId, voter, selectedVerdict, rationaleInput.trim());
      const nextVoter = unvoted.find((a) => a.arbitratorId !== voter);
      if (nextVoter) setSelectedArbitratorId(nextVoter.arbitratorId);
      refreshState();
      onLog(
        res.resolved
          ? `Board reached a decision on ${disputeId}: ${res.status}.`
          : `Vote recorded. ${res.dispute.votes.size} cast, ${res.dispute.requiredThreshold} matching needed.`,
        res.resolved ? "success" : "info"
      );
    } catch (err: any) {
      onLog(`Vote error: ${err.message}`, "error");
    }
  };

  return (
    <div className="page">
      <PageHead
        num="06"
        section="Disputes"
        title="When the evidence is not enough, a board decides."
        lede="Some work cannot be checked by a hash alone. A case goes to three arbitrators. Two matching votes settle it, and the escrow follows their decision."
        aside={<Tag tone="warn">Simulation</Tag>}
      />

      <section>
        <div className="section-row">
          <h2 className="section">The board</h2>
          <span className="small muted">2 of 3 votes decide a case</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Arbitrator</th>
                <th>Type</th>
                <th className="hide-sm">Key commitment</th>
                <th className="num">Reputation</th>
                {currentDispute && <th className="num">Vote</th>}
              </tr>
            </thead>
            <tbody>
              {pactraState.arbitrators.map((arb: Arbitrator) => (
                <tr key={arb.arbitratorId}>
                  <td style={{ fontWeight: 500 }}>{arb.name}</td>
                  <td className="small">{arb.isHuman ? "Human panel" : "SLA oracle"}</td>
                  <td className="hide-sm">
                    <Hash value={arb.publicKeyCommitment} head={14} tail={6} />
                  </td>
                  <td className="num">{arb.reputationScore}/100</td>
                  {currentDispute && (
                    <td className="num">
                      {votedIds.has(arb.arbitratorId) ? <Tag tone="ink">Voted</Tag> : <span className="faint small">Pending</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="cols-2 section-block">
        <section className="sheet" aria-labelledby="open-case">
          <div className="sheet-head">
            <h3 className="sub" id="open-case">
              Open a case
            </h3>
          </div>
          <form
            className="sheet-body"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              handleOpenDispute();
            }}
          >
            <div className="field">
              <label className="label" htmlFor="claimant">
                Who is raising it
              </label>
              <select id="claimant" className="select" value={claimantInput} onChange={(e) => setClaimantInput(e.target.value as any)}>
                <option value="CREATOR">Task creator</option>
                <option value="PROVIDER">Service provider</option>
                <option value="AUTOMATED_VERIFIER">Automated verifier</option>
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="reason">
                What went wrong
              </label>
              <textarea
                id="reason"
                className="textarea"
                rows={3}
                value={disputeReasonInput}
                onChange={(e) => setDisputeReasonInput(e.target.value)}
                required
                maxLength={500}
                aria-invalid={Boolean(reasonError)}
                aria-describedby="reason-error"
              />
              <FieldError id="reason-error">{reasonError}</FieldError>
              <p className="hint">
                Filed against purchase <span className="hash">{targetProcurementId}</span>
                {pactraState.activeProcurements.length === 0 && ", a sample, since you have not bought anything yet"}.
              </p>
            </div>
            {openCaseForTarget && (
              <p className="small muted" style={{ marginTop: 12 }}>
                This purchase already has an open case. Wait for the board to decide it.
              </p>
            )}
            <button
              type="submit"
              className="btn btn--danger btn--block"
              style={{ marginTop: 16 }}
              disabled={Boolean(reasonError) || Boolean(openCaseForTarget)}
            >
              Open case
            </button>
          </form>
        </section>

        <section className="sheet" aria-labelledby="case-title">
          <div className="sheet-head">
            <h3 className="sub" id="case-title">
              {currentDispute ? (
                <>
                  Case <span className="hash">{currentDispute.disputeId}</span>
                </>
              ) : (
                "Current case"
              )}
            </h3>
            {currentDispute && (
              <Tag tone={currentDispute.status.startsWith("RESOLVED") ? "ok" : "warn"}>
                {currentDispute.status.replace(/_/g, " ")}
              </Tag>
            )}
          </div>

          {!currentDispute ? (
            <div className="sheet-body small muted">No open cases. Open one on the left to see the board vote.</div>
          ) : (
            <div className="sheet-body stack">
              {activeDisputes.length > 1 && (
                <div className="field">
                  <label className="label" htmlFor="case-pick">
                    Case
                  </label>
                  <select
                    id="case-pick"
                    className="select"
                    value={currentDispute.disputeId}
                    onChange={(e) => setSelectedDisputeId(e.target.value)}
                  >
                    {activeDisputes.map((d) => (
                      <option key={d.disputeId} value={d.disputeId}>
                        {d.disputeId} ({d.status.replace(/_/g, " ").toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <dl className="kv">
                <dt>Raised by</dt>
                <dd>{currentDispute.claimant.toLowerCase().replace(/_/g, " ")}</dd>
                <dt>Reason</dt>
                <dd className="small">{currentDispute.reason}</dd>
                <dt>Votes</dt>
                <dd>
                  <span className="row" style={{ justifyContent: "flex-end", gap: 4 }}>
                    {pactraState.arbitrators.map((a, i) => (
                      <Mark key={a.arbitratorId} kind={i < currentDispute.votes.size ? "fill" : "empty"} />
                    ))}
                    <span className="small" style={{ marginLeft: 6 }}>
                      {currentDispute.votes.size} cast, {currentDispute.requiredThreshold} matching needed
                    </span>
                  </span>
                </dd>
              </dl>

              {deadlocked && (
                <div className="notice notice--warn">
                  <div className="notice-title">No majority</div>
                  Every arbitrator voted differently. The case stays open until{" "}
                  {new Date(currentDispute.timeoutTimestamp).toLocaleString()}, then refunds the creator.
                </div>
              )}

              {currentDispute.status === "PENDING_ARBITRATION" && !deadlocked && (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCastVote();
                  }}
                >
                  <div className="cols-2" style={{ gap: 12 }}>
                    <div>
                      <label className="label" htmlFor="arb">
                        Vote as
                      </label>
                      <select id="arb" className="select" value={voter} onChange={(e) => setSelectedArbitratorId(e.target.value)}>
                        {pactraState.arbitrators.map((a) => (
                          <option key={a.arbitratorId} value={a.arbitratorId} disabled={votedIds.has(a.arbitratorId)}>
                            {a.name}
                            {votedIds.has(a.arbitratorId) ? " (voted)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="verdict">
                        Verdict
                      </label>
                      <select
                        id="verdict"
                        className="select"
                        value={selectedVerdict}
                        onChange={(e) => setSelectedVerdict(e.target.value as ArbitrationVerdict)}
                      >
                        {(Object.keys(VERDICT_LABEL) as ArbitrationVerdict[]).map((v) => (
                          <option key={v} value={v}>
                            {VERDICT_LABEL[v]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="field" style={{ marginTop: 12 }}>
                    <label className="label" htmlFor="rationale">
                      Reasoning
                    </label>
                    <input
                      id="rationale"
                      type="text"
                      className="input"
                      value={rationaleInput}
                      onChange={(e) => setRationaleInput(e.target.value)}
                      required
                      maxLength={280}
                      aria-invalid={Boolean(rationaleError)}
                      aria-describedby="rationale-error"
                    />
                    <FieldError id="rationale-error">{rationaleError}</FieldError>
                  </div>
                  <button type="submit" className="btn btn--primary btn--block" style={{ marginTop: 16 }} disabled={!voter || Boolean(rationaleError)}>
                    Cast vote
                  </button>
                </form>
              )}

              {currentDispute.resolutionSummary && (
                <div className="notice notice--ok">
                  <div className="notice-title">Decision</div>
                  {currentDispute.resolutionSummary}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
