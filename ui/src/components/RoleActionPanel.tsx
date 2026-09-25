import React, { useState } from "react";
import { EscrowContractData, TaskStateName } from "../services/escrowService";
import { TxLifecycleEvent } from "../services/contractClient";
import { FieldError, Hash, Mark, parseAmount, useSingleFlight } from "./ui";

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

type Role = "creator" | "agent";

const NEXT: Record<TaskStateName, { role: Role | null; text: string }> = {
  UNINITIALIZED: { role: "creator", text: "Create a task and set its budget ceiling." },
  CREATED: { role: "creator", text: "Deposit funds into the escrow." },
  FUNDED: { role: "agent", text: "The agent accepts the task." },
  ACTIVE: { role: "agent", text: "The agent submits a hash of its result." },
  COMPLETION_PENDING: { role: "creator", text: "Check the evidence, then release the payout." },
  COMPLETED: { role: null, text: "This pact is settled. Reset to run another." },
  REFUNDED: { role: null, text: "Funds went back to the creator. Reset to run another." },
};

const TX_STAGES = ["READY", "WALLET_REQUIRED", "USER_SIGNATURE_REQUIRED", "SUBMITTED", "CONFIRMING", "CONFIRMED", "INDEXED"];
const TX_LABEL: Record<string, string> = {
  READY: "Ready",
  WALLET_REQUIRED: "Wallet",
  USER_SIGNATURE_REQUIRED: "Sign",
  SUBMITTED: "Submitted",
  CONFIRMING: "Confirming",
  CONFIRMED: "Confirmed",
  INDEXED: "Indexed",
};

const AMOUNT_HINT = "Enter a whole number of DUST, 1 or more.";

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
  const [role, setRole] = useState<Role>("creator");
  const [budgetRaw, setBudgetRaw] = useState<string>("500");
  const [fundRaw, setFundRaw] = useState<string>("250");
  const [payoutRaw, setPayoutRaw] = useState<string>("250");
  const [evidenceInput, setEvidenceInput] = useState<string>("0xipfs_result_sha256_output_data_valid");
  const [joinAddressInput, setJoinAddressInput] = useState<string>("");
  const [actionError, setActionError] = useState<{ message: string; recovery: string } | null>(null);
  const { busy: loading, run } = useSingleFlight();

  const txPending = Boolean(txLifecycle && ["PENDING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(txLifecycle.status));
  const isBusy = loading || txPending;

  const next = NEXT[data.taskState];

  // Amounts are whole DUST; the contract rejects anything else, so catch it before the wallet prompt.
  const budget = parseAmount(budgetRaw);
  const fund = parseAmount(fundRaw);
  const payout = parseAmount(payoutRaw);
  const room = Math.max(0, data.maxBudget - data.escrowedAmount);
  const joinAddress = joinAddressInput.trim().replace(/^0x/i, "");
  const joinValid = /^[0-9a-f]{64,70}$/i.test(joinAddress);

  const budgetError = budget === null ? AMOUNT_HINT : null;
  const fundFull = room === 0;
  const fundError = fundFull
    ? null
    : fund === null
      ? AMOUNT_HINT
      : fund > room
      ? `That is over the ceiling. You can add up to ${room}.`
      : null;
  const payoutError =
    payout === null ? AMOUNT_HINT : payout > data.escrowedAmount ? `Only ${data.escrowedAmount} DUST is in escrow.` : null;
  const evidenceError = evidenceInput.trim() === "" ? "Enter the hash of the result." : null;
  const joinError =
    joinAddressInput.trim() !== "" && !joinValid
      ? "That does not look like a contract address. Expect 64 to 70 hex characters, usually starting with 0200."
      : null;

  const handleAction = (action: () => Promise<void>) =>
    run(async () => {
      if (txPending) return;
      setActionError(null);
      try {
        await action();
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        let recovery = "Check that Lace is unlocked and the Preprod indexer is reachable, then try again.";

        if (/reject|denied|cancel/i.test(errMsg)) {
          recovery = "You declined the request in Lace. Try again when you are ready.";
        } else if (/insufficient|balance|dust/i.test(errMsg)) {
          recovery = "Your wallet does not have enough DUST. Get free test funds from the Nethermind faucet.";
        } else if (/timeout|timed out/i.test(errMsg)) {
          recovery = "Confirmation is taking longer than usual. Check the Lace activity tab, then press Sync on the ledger.";
        } else if (/network|preprod|unsupported/i.test(errMsg)) {
          recovery = "Set the network selector inside Lace to Midnight Preprod.";
        }

        setActionError({ message: errMsg, recovery });
      }
    });

  const handleRefund = () => {
    const msg = isLiveMode
      ? `Cancel this task and return ${data.escrowedAmount} DUST to the creator? This sends a transaction and cannot be undone.`
      : "Cancel this task and refund the creator?";
    if (window.confirm(msg)) handleAction(onRefundTask);
  };

  const txCurrent = txLifecycle?.status === "PENDING_USER_SIGNATURE" ? "USER_SIGNATURE_REQUIRED" : txLifecycle?.status;
  const txIdx = TX_STAGES.indexOf(txCurrent || "");

  return (
    <section className="sheet" aria-labelledby="actions-title" aria-busy={isBusy}>
      <div className="sheet-head">
        <div>
          <h3 className="sub" id="actions-title">
            Actions
          </h3>
          <div className="tiny faint">
            {isLiveMode ? "Each action is a zero-knowledge transaction you sign in Lace." : "Simulation. Nothing is sent on-chain."}
          </div>
        </div>
        {!isLiveMode && (
          <button className="linkbtn" onClick={onResetDemo} disabled={isBusy}>
            Reset simulation
          </button>
        )}
      </div>

      <div className="sheet-body stack">
        {actionError && (
          <div id="action-error-recovery-card" className="notice notice--bad" role="alert">
            <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
              <div>
                <div className="notice-title">{actionError.message}</div>
                <div>{actionError.recovery}</div>
              </div>
              <button className="close-x" onClick={() => setActionError(null)} aria-label="Dismiss error" />
            </div>
          </div>
        )}

        {txLifecycle && txLifecycle.status !== "IDLE" && (
          <div
            id="tx-lifecycle-tracker"
            className={`notice ${
              txLifecycle.status === "FAILED"
                ? "notice--bad"
                : txLifecycle.status === "CONFIRMED" || txLifecycle.status === "INDEXED"
                ? "notice--ok"
                : ""
            }`}
            aria-live="polite"
          >
            <div className="notice-title">Transaction: {txLifecycle.status.replace(/_/g, " ").toLowerCase()}</div>
            <div className="row" style={{ gap: "4px 14px", margin: "6px 0 8px" }}>
              {TX_STAGES.map((stage, idx) => {
                const passed = txIdx !== -1 && idx < txIdx;
                const cur = stage === txCurrent;
                return (
                  <span key={stage} className={`tiny row ${cur ? "" : passed ? "muted" : "faint"}`} style={{ gap: 5, fontWeight: cur ? 600 : 400 }}>
                    <Mark kind={passed ? "fill" : cur ? "half" : "empty"} tone={cur ? "seal" : undefined} />
                    {TX_LABEL[stage]}
                  </span>
                );
              })}
            </div>
            <div className="small">{txLifecycle.message}</div>
            {txLifecycle.txHash && (
              <div className="tiny" style={{ marginTop: 4 }}>
                Tx <Hash value={txLifecycle.txHash} head={14} tail={10} />
                {txLifecycle.blockHeight && <span className="faint"> in block #{txLifecycle.blockHeight}</span>}
              </div>
            )}
          </div>
        )}

        {!data.contractAddress ? (
          <div className="notice">
            <div className="notice-title">Deploy a contract to go live</div>
            <p className="small" style={{ marginBottom: 12 }}>
              You can use the actions below in simulation right away. To send real transactions, deploy TaskEscrow to
              Preprod with Lace (about a minute, paid in test DUST) or attach an address someone shared with you.
            </p>
            <button
              id="btn-deploy-preprod"
              className="btn btn--primary btn--block"
              disabled={isBusy}
              onClick={() => handleAction(onDeployContract)}
            >
              {isBusy ? "Deploying on Preprod..." : "Deploy TaskEscrow to Preprod"}
            </button>
            <label className="label" htmlFor="join-address" style={{ marginTop: 14 }}>
              Or attach an existing contract
            </label>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (joinValid && !isBusy) handleAction(() => onJoinContract(joinAddressInput.trim()));
              }}
            >
              <input
                id="join-address"
                type="text"
                placeholder="0200..."
                className="input mono"
                value={joinAddressInput}
                onChange={(e) => setJoinAddressInput(e.target.value)}
                aria-invalid={Boolean(joinError)}
                aria-describedby="join-error"
                spellCheck={false}
                autoComplete="off"
              />
              <button type="submit" className="btn" disabled={isBusy || !joinValid}>
                Attach
              </button>
            </form>
            <FieldError id="join-error">{joinError}</FieldError>
            <p className="hint">
              Need test funds? Use the{" "}
              <a href="https://midnight-tmnight-preprod.nethermind.dev/" target="_blank" rel="noreferrer">
                Nethermind faucet
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="row-between small">
            <span className="row">
              <Mark tone="ok" />
              Contract <Hash value={data.contractAddress} />
            </span>
            <button
              className="linkbtn"
              disabled={isBusy}
              onClick={() => {
                if (window.confirm("Detach this contract? You can redeploy or attach another afterwards.")) {
                  localStorage.removeItem("midnight_task_escrow_contract_address");
                  window.location.reload();
                }
              }}
            >
              Change contract
            </button>
          </div>
        )}

        <div className="notice notice--next">
          <div className="notice-title">Next</div>
          <div className="row-between">
            <span>{next.text}</span>
            {next.role && next.role !== role && (
              <button className="linkbtn" onClick={() => setRole(next.role as Role)}>
                Switch to {next.role}
              </button>
            )}
          </div>
        </div>

        <div className="segmented segmented--block" role="tablist" aria-label="Act as">
          <button id="tab-creator" role="tab" aria-selected={role === "creator"} onClick={() => setRole("creator")}>
            Creator
          </button>
          <button id="tab-agent" role="tab" aria-selected={role === "agent"} onClick={() => setRole("agent")}>
            Agent
          </button>
        </div>

        {role === "creator" && (
          <div className="stack">
            {data.taskState === "UNINITIALIZED" && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (budget !== null && !isBusy) handleAction(() => onCreateTask(budget));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="budget">
                    Budget ceiling (DUST)
                  </label>
                  <input
                    id="budget"
                    type="number"
                    inputMode="numeric"
                    className="input"
                    value={budgetRaw}
                    onChange={(e) => setBudgetRaw(e.target.value)}
                    min={1}
                    step={1}
                    required
                    aria-invalid={Boolean(budgetError)}
                    aria-describedby="budget-error"
                  />
                  <FieldError id="budget-error">{budgetError}</FieldError>
                  {!budgetError && <p className="hint">The most this task can ever spend. The agent cannot raise it.</p>}
                </div>
                <button id="btn-create-task" type="submit" className="btn btn--primary btn--block" style={{ marginTop: 16 }} disabled={isBusy || budget === null}>
                  {isBusy ? "Submitting..." : "Create task"}
                </button>
              </form>
            )}

            {(data.taskState === "CREATED" || data.taskState === "FUNDED") && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (fund !== null && !fundFull && !fundError && !isBusy) handleAction(() => onFundTask(fund));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="fund">
                    Deposit (DUST)
                  </label>
                  <input
                    id="fund"
                    type="number"
                    inputMode="numeric"
                    className="input"
                    value={fundRaw}
                    onChange={(e) => setFundRaw(e.target.value)}
                    max={room}
                    min={1}
                    step={1}
                    required
                    disabled={fundFull}
                    aria-invalid={Boolean(fundError)}
                    aria-describedby="fund-error"
                  />
                  <FieldError id="fund-error">{fundError}</FieldError>
                  {!fundError && (
                    <p className="hint">
                      {fundFull
                        ? `Fully funded at ${data.maxBudget} DUST. Switch to agent to accept.`
                        : `${data.escrowedAmount} of ${data.maxBudget} held. You can add up to ${room}.`}
                    </p>
                  )}
                </div>
                <button id="btn-fund-task" type="submit" className="btn btn--primary btn--block" style={{ marginTop: 16 }} disabled={isBusy || fundFull || Boolean(fundError)}>
                  {isBusy ? "Submitting deposit..." : "Fund escrow"}
                </button>
              </form>
            )}

            {data.taskState === "COMPLETION_PENDING" && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (payout !== null && !payoutError && !isBusy) handleAction(() => onSettleTask(payout));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="payout">
                    Payout to agent (DUST)
                  </label>
                  <input
                    id="payout"
                    type="number"
                    inputMode="numeric"
                    className="input"
                    value={payoutRaw}
                    onChange={(e) => setPayoutRaw(e.target.value)}
                    max={data.escrowedAmount}
                    min={1}
                    step={1}
                    required
                    aria-invalid={Boolean(payoutError)}
                    aria-describedby="payout-error"
                  />
                  <FieldError id="payout-error">{payoutError}</FieldError>
                  {!payoutError && <p className="hint">Up to {data.escrowedAmount} DUST held in escrow.</p>}
                </div>
                <button id="btn-settle-task" type="submit" className="btn btn--seal btn--block" style={{ marginTop: 16 }} disabled={isBusy || Boolean(payoutError)}>
                  {isBusy ? "Releasing..." : "Release payout"}
                </button>
              </form>
            )}

            {data.taskState === "ACTIVE" && <p className="small muted">The agent is working. Nothing for the creator to do until it submits evidence.</p>}

            {["CREATED", "FUNDED", "ACTIVE", "COMPLETION_PENDING"].includes(data.taskState) && (
              <button id="btn-refund-task" className="btn btn--danger btn--block" disabled={isBusy} onClick={handleRefund}>
                {isBusy ? "Processing..." : "Cancel and refund"}
              </button>
            )}

            {(data.taskState === "COMPLETED" || data.taskState === "REFUNDED") && (
              <p className="small muted">This task is closed ({data.taskState.toLowerCase()}).</p>
            )}
          </div>
        )}

        {role === "agent" && (
          <div className="stack">
            {data.taskState === "FUNDED" && (
              <div>
                <p className="small muted" style={{ marginBottom: 12 }}>
                  {data.escrowedAmount} DUST is waiting in escrow. Accepting proves you hold the authorised agent key
                  without revealing it.
                </p>
                <button id="btn-accept-task" className="btn btn--primary btn--block" disabled={isBusy} onClick={() => handleAction(onAcceptTask)}>
                  {isBusy ? "Proving..." : "Accept task"}
                </button>
              </div>
            )}

            {data.taskState === "ACTIVE" && (
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!evidenceError && !isBusy) handleAction(() => onSubmitCompletion(evidenceInput.trim()));
                }}
              >
                <div className="field">
                  <label className="label" htmlFor="evidence">
                    Result hash
                  </label>
                  <input
                    id="evidence"
                    type="text"
                    className="input mono"
                    value={evidenceInput}
                    onChange={(e) => setEvidenceInput(e.target.value)}
                    required
                    spellCheck={false}
                    aria-invalid={Boolean(evidenceError)}
                    aria-describedby="evidence-error"
                  />
                  <FieldError id="evidence-error">{evidenceError}</FieldError>
                  {!evidenceError && <p className="hint">A hash of the output. The output itself stays off-chain.</p>}
                </div>
                <button
                  id="btn-submit-completion"
                  type="submit"
                  className="btn btn--primary btn--block"
                  style={{ marginTop: 16 }}
                  disabled={isBusy || Boolean(evidenceError)}
                >
                  {isBusy ? "Submitting..." : "Submit evidence"}
                </button>
              </form>
            )}

            {data.taskState !== "FUNDED" && data.taskState !== "ACTIVE" && (
              <p className="small muted">
                {data.taskState === "UNINITIALIZED" || data.taskState === "CREATED"
                  ? "Nothing to do yet. The creator has to fund the task first."
                  : data.taskState === "COMPLETION_PENDING"
                  ? "Evidence is in. Waiting for the creator to settle."
                  : "This task is closed."}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
