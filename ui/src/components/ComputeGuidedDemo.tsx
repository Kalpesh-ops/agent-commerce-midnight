import React, { useState } from "react";
import { pactraUiService } from "../services/pactraUiService";
import { ProcurementRecord, ExecutionEvidence, VerificationResult } from "../../../contract/src/index.js";
import { Hash, LogFn, Mark, PageHead, Tag, useSingleFlight } from "./ui";

interface ComputeGuidedDemoProps {
  onLog: LogFn;
  onNavigateToEscrow?: () => void;
}

interface StepInfo {
  title: string;
  action: string;
  shortDesc: string;
  shielded: string[];
  observable: string[];
}

const STEPS: StepInfo[] = [
  {
    title: "Create the task",
    action: "Create task",
    shortDesc: "Describe the job: run a matrix factorisation on a private dataset. The description never leaves your browser.",
    shielded: ["Objective: matrix factorisation and inference", "Input data shape and weights", "How the agent should approach it"],
    observable: ["Task id: task_compute_demo_01", "Block height the task was created at"],
  },
  {
    title: "Set policy and budget",
    action: "Save policy",
    shortDesc: "Cap total spend, cap each purchase, and allow only the COMPUTE category.",
    shielded: ["Allowed capabilities: COMPUTE", "Detailed spending rules", "Per purchase limit: 3 DUST"],
    observable: ["Total budget ceiling: 10 DUST", "Expiry: 7 days from now"],
  },
  {
    title: "Authorise the agent",
    action: "Authorise agent",
    shortDesc: "Pactra hashes the policy into a commitment. The agent receives authority under that commitment and nothing else.",
    shielded: ["Your wallet keys and seed phrase, never shared", "Witness preimages for the proofs"],
    observable: ["Policy commitment: H(policy, salt)", "Authority status: BOUNDED_ACTIVE"],
  },
  {
    title: "Find a compute provider",
    action: "Select provider",
    shortDesc: "The agent looks up registered enclave compute providers that the policy allows.",
    shielded: ["Why the agent picked this provider", "What else the pipeline depends on"],
    observable: ["Provider id: 0xprovider_alpha_enclave_99a4c102", "Unit price: 3 DUST", "SLA: 99.9%"],
  },
  {
    title: "Request the purchase",
    action: "Request purchase",
    shortDesc: "The agent asks to buy one compute job. The policy engine checks budget and category before approving.",
    shielded: ["The dataset in plain text", "Execution instructions"],
    observable: ["Capability requested: COMPUTE", "Job id hash", "Authorisation token id"],
  },
  {
    title: "Reserve escrow",
    action: "Reserve funds",
    shortDesc: "Three DUST are locked against the completion condition. The agent still cannot move them.",
    shielded: ["The escrow's spending secret"],
    observable: ["Locked: 3 DUST", "Remaining budget: 7 DUST", "State: ESCROW_ACTIVE"],
  },
  {
    title: "Receive evidence",
    action: "Run job",
    shortDesc: "The provider runs the job inside a secure enclave and returns a signed attestation of the output.",
    shielded: ["Enclave memory and intermediate tensors", "The provider's enclave key"],
    observable: ["Attestation hash", "Output commitment: H(result)", "Execution time"],
  },
  {
    title: "Verify evidence",
    action: "Verify",
    shortDesc: "The verifier checks the evidence against the condition committed in step 3.",
    shielded: ["The verifier's evaluation logic"],
    observable: ["Result: valid or rejected", "Attestation check", "Cost check: 3 of 3 DUST"],
  },
  {
    title: "Settle or refund",
    action: "Finish",
    shortDesc: "Valid evidence releases payment to the provider. Invalid evidence sends it back to you.",
    shielded: ["Settlement witness secret"],
    observable: ["Settlement status", "Payout or refund amount", "Final escrow state"],
  },
];

export const ComputeGuidedDemo: React.FC<ComputeGuidedDemoProps> = ({ onLog, onNavigateToEscrow }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [viewStep, setViewStep] = useState<number>(1);
  const [procurementRecord, setProcurementRecord] = useState<ProcurementRecord | null>(null);
  const [evidence, setEvidence] = useState<ExecutionEvidence | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [settled, setSettled] = useState<boolean>(false);
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const { busy: isProcessing, run } = useSingleFlight();

  const shown = STEPS[viewStep - 1];
  const isReviewing = viewStep !== currentStep;

  const advance = (to: number) => {
    setCurrentStep(to);
    setViewStep(to);
  };

  const handleStepAction = () =>
    run(async () => {
    try {
      switch (currentStep) {
        case 1:
          onLog("Walkthrough: private task created (task_compute_demo_01).", "info");
          advance(2);
          break;
        case 2:
          onLog("Walkthrough: policy saved. 10 DUST ceiling, 3 DUST per purchase, COMPUTE only.", "info");
          advance(3);
          break;
        case 3:
          onLog("Walkthrough: policy commitment anchored. Agent holds a bounded capability token.", "success");
          advance(4);
          break;
        case 4:
          onLog("Walkthrough: provider selected (srv_compute_alpha, secure enclave).", "info");
          advance(5);
          break;
        case 5: {
          const record = await pactraUiService.procureComputeJob({
            jobId: `job_comp_${Date.now().toString(36)}`,
            serviceId: "srv_compute_alpha",
            instructions: "Execute confidential matrix decomposition in SGX enclave",
            inputDatasetHash: "0xinput_matrix_norm_a91b4",
            maxDurationSeconds: 30,
          });
          setProcurementRecord(record);
          onLog(`Walkthrough: policy approved purchase ${record.procurementId}. 3 DUST reserved.`, "success");
          advance(6);
          break;
        }
        case 6:
          onLog("Walkthrough: 3 DUST locked in escrow.", "info");
          advance(7);
          break;
        case 7: {
          if (!procurementRecord) {
            throw new Error("No purchase on record. Restart from step 5.");
          }
          const ev = await pactraUiService.executeProcurement(
            procurementRecord.procurementId,
            simulateFailure ? "INVALID_EVIDENCE" : undefined
          );
          setEvidence(ev);
          onLog(`Walkthrough: evidence received from ${ev.providerCommitment.slice(0, 16)}...`, "success");
          advance(8);
          break;
        }
        case 8: {
          if (!evidence) {
            throw new Error("No evidence yet. Complete step 7 first.");
          }
          const vRes = pactraUiService.verifyCompletion(evidence, simulateFailure);
          setVerificationResult(vRes);
          onLog(
            vRes.verified ? "Walkthrough: evidence verified." : `Walkthrough: verification failed (${vRes.failureReason}).`,
            vRes.verified ? "success" : "error"
          );
          advance(9);
          break;
        }
        case 9:
          onLog(
            verificationResult?.verified
              ? "Walkthrough: 3 DUST paid to the provider. 7 DUST budget left."
              : "Walkthrough: 3 DUST refunded to you because the evidence failed.",
            verificationResult?.verified ? "success" : "info"
          );
          setSettled(true);
          break;
      }
    } catch (err: any) {
      onLog(`Step ${currentStep} failed: ${err.message}`, "error");
    }
    });

  const handleReset = () => {
    advance(1);
    setProcurementRecord(null);
    setEvidence(null);
    setVerificationResult(null);
    setSettled(false);
    setSimulateFailure(false);
    onLog("Walkthrough reset.", "info");
  };

  const actionLabel = isProcessing
    ? "Working..."
    : currentStep === 9
    ? verificationResult?.verified
      ? "Release payment"
      : "Refund me"
    : shown.action;

  return (
    <div className="page">
      <PageHead
        num="02"
        section="Walkthrough"
        title="Buy one compute job without handing over your wallet."
        lede="Nine steps through the real Pactra policy engine, procurement and verifier. It runs in your browser, so no wallet is needed. At each step you can see what stays private and what the chain would see."
        aside={
          <button className="btn btn--sm" onClick={handleReset} disabled={isProcessing || (currentStep === 1 && !settled)}>
            Start over
          </button>
        }
      />

      <div className="cols-split cols-steps">
        <ol className="steplist" aria-label="Steps">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = n < currentStep || (n === 9 && settled);
            const cur = n === currentStep && !settled;
            return (
              <li key={s.title}>
                <button
                  className={done ? "is-done" : cur ? "is-current" : ""}
                  onClick={() => (done || cur) && !isProcessing && setViewStep(n)}
                  aria-current={viewStep === n ? "step" : undefined}
                  disabled={!done && !cur}
                  style={viewStep === n && !cur ? { background: "var(--paper-2)" } : undefined}
                >
                  <span className="step-n">{String(n).padStart(2, "0")}</span>
                  <span>{s.title}</span>
                  {done ? <Mark tone="ok" /> : cur ? <Mark kind="half" tone="seal" /> : <Mark kind="empty" tone="faint" />}
                </button>
              </li>
            );
          })}
        </ol>

        <section className="sheet" aria-labelledby="step-title">
          <div className="sheet-head">
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                <span className="num">Step {viewStep} of 9</span>
                {isReviewing && <span>Reviewing</span>}
              </div>
              <h2 className="section" id="step-title">
                {shown.title}
              </h2>
            </div>
            {isReviewing ? (
              <button className="btn btn--sm" onClick={() => setViewStep(currentStep)}>
                Back to step {currentStep}
              </button>
            ) : settled ? (
              <Tag tone={verificationResult?.verified ? "ok" : "bad"}>{verificationResult?.verified ? "Paid" : "Refunded"}</Tag>
            ) : (
              <button className="btn btn--seal" disabled={isProcessing} onClick={handleStepAction}>
                {actionLabel}
              </button>
            )}
          </div>

          <div className="sheet-body stack">
            <p className="muted" style={{ fontSize: 16 }}>
              {shown.shortDesc}
            </p>

            {currentStep === 7 && !isReviewing && (
              <label className="row small" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
                Make the provider return corrupted evidence, to see the refund path
              </label>
            )}

            <div className="ruled-2">
              <div className="sheet-body disclose disclose--shielded">
                <h4>
                  <Mark /> Stays private
                </h4>
                <ul>
                  {shown.shielded.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="sheet-body disclose disclose--public">
                <h4>
                  <Mark kind="empty" /> Visible on-chain
                </h4>
                <ul>
                  {shown.observable.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="sheet-foot">
            <h3 className="sub" style={{ marginBottom: 10 }}>
              Produced so far
            </h3>
            <dl className="kv">
              <dt>Provider</dt>
              <dd>
                <span className="hash">srv_compute_alpha</span> <span className="faint">3 DUST</span>
              </dd>
              <dt>Purchase id</dt>
              <dd>
                <Hash value={procurementRecord?.procurementId} empty="After step 5" />
              </dd>
              <dt>Capability token</dt>
              <dd>
                <Hash value={procurementRecord ? procurementRecord.authToken?.authorizationId || "auth_pre_approved_token" : null} empty="After step 5" />
              </dd>
              <dt>Attestation</dt>
              <dd>
                <Hash value={evidence?.evidenceSignature} empty="After step 7" />
              </dd>
              <dt>Output commitment</dt>
              <dd>
                <Hash value={evidence?.outputHash} empty="After step 7" />
              </dd>
              <dt>Verifier</dt>
              <dd className={verificationResult ? (verificationResult.verified ? "c-ok" : "c-bad") : "faint"}>
                {verificationResult
                  ? verificationResult.verified
                    ? "Passed"
                    : `Rejected: ${verificationResult.failureReason}`
                  : "After step 8"}
              </dd>
            </dl>

            {settled && (
              <div className={`notice ${verificationResult?.verified ? "notice--ok" : "notice--warn"}`} style={{ marginTop: 16 }}>
                <div className="notice-title">
                  {verificationResult?.verified ? "3 DUST paid to the provider" : "3 DUST returned to you"}
                </div>
                At no point did the agent see your seed phrase, private key or full balance. It only ever held the rights in
                the policy commitment.
                {onNavigateToEscrow && (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn btn--sm btn--primary" onClick={onNavigateToEscrow}>
                      Try the same flow on the escrow contract
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
