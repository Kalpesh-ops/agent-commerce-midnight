import React, { useState } from "react";
import { pactraUiService } from "../services/pactraUiService";
import {
  ProcurementRecord,
  ExecutionEvidence,
  VerificationResult,
} from "../../../contract/src/index.js";

interface ComputeGuidedDemoProps {
  onLog: (text: string, type?: "info" | "success" | "error") => void;
  onNavigateToEscrow?: () => void;
}

interface StepInfo {
  number: number;
  title: string;
  shortDesc: string;
  shielded: string[];
  observable: string[];
}

const STEPS: StepInfo[] = [
  {
    number: 1,
    title: "1. Create Task",
    shortDesc: "Define the high-level computational objective without revealing private parameters to the network.",
    shielded: ["Objective: Matrix Factorization / ML Inference", "Input Data Shape & Weights", "Internal Agent Strategy"],
    observable: ["Task Identifier: task_compute_demo_01", "Task Creation Block Height"],
  },
  {
    number: 2,
    title: "2. Define Policy & Budget",
    shortDesc: "Set strict spending limits, approved capability categories, and completion condition specs.",
    shielded: ["Full Capability Matrix: ['COMPUTE']", "Detailed Discretionary Rules", "Per-Transaction Limit: 3 DUST"],
    observable: ["Maximum Total Budget: 10 DUST", "Expiration Timestamp (+7 Days)"],
  },
  {
    number: 3,
    title: "3. Authorize Bounded Agent",
    shortDesc: "Generate the cryptographic Policy Commitment. The agent receives bounded authority, NOT your wallet keys.",
    shielded: ["User Wallet Private Key / Seed (NEVER SHARED)", "Zero-Knowledge Witness Preimages"],
    observable: ["Policy Commitment: H(Policy, Salt)", "Authority Status: BOUNDED_ACTIVE"],
  },
  {
    number: 4,
    title: "4. Discover Compute Service",
    shortDesc: "Agent queries the generalized registry for verified secure enclave compute providers.",
    shielded: ["Service Selection Logic", "Target Pipeline Dependencies"],
    observable: ["Provider ID: 0xprovider_alpha_enclave_99a4c102", "Unit Price: 3 DUST", "SLA: 99.9%"],
  },
  {
    number: 5,
    title: "5. Request Procurement",
    shortDesc: "Agent submits a structured micro-procurement request. Policy engine verifies budget and authorization.",
    shielded: ["Input Dataset Plaintext", "Task Execution Instructions"],
    observable: ["Capability Request: COMPUTE", "Job Identifier Hash", "Authorization Token ID"],
  },
  {
    number: 6,
    title: "6. Reserve Escrow",
    shortDesc: "Escrow reserves required funds locked against completion condition commitment.",
    shielded: ["Escrow Account Private Spending Secret"],
    observable: ["Escrow Locked Amount: 3 DUST", "Remaining Agent Budget: 7 DUST", "State: ESCROW_ACTIVE"],
  },
  {
    number: 7,
    title: "7. Receive Execution Evidence",
    shortDesc: "Compute node runs confidential job in TEE and produces verifiable cryptographic attestation.",
    shielded: ["Raw Execution Memory & Intermediate Tensors", "Provider Private Enclave Key"],
    observable: ["Enclave Attestation Hash", "Output Commitment: H(Result)", "Execution Duration: 1.24s"],
  },
  {
    number: 8,
    title: "8. Verify Evidence",
    shortDesc: "Objective condition verifier checks proof of execution against initial condition commitment.",
    shielded: ["Verifier Private Evaluation Logic"],
    observable: ["Verification Result: VALID", "Attestation Check: PASSED", "Cost Check: 3 <= 3 DUST"],
  },
  {
    number: 9,
    title: "9. Settle or Refund",
    shortDesc: "Verified evidence unlocks the escrow payout to provider (or refunds creator on invalid evidence).",
    shielded: ["Settlement Witness Secret"],
    observable: ["Settlement Status: SETTLED_SUCCESS", "Payout: 3 DUST to Provider", "Final Escrow State: COMPLETE"],
  },
];

export const ComputeGuidedDemo: React.FC<ComputeGuidedDemoProps> = ({
  onLog,
  onNavigateToEscrow,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [procurementRecord, setProcurementRecord] = useState<ProcurementRecord | null>(null);
  const [evidence, setEvidence] = useState<ExecutionEvidence | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [settled, setSettled] = useState<boolean>(false);
  const [simulateFailure, setSimulateFailure] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const activeStepInfo = STEPS[currentStep - 1];

  const handleStepAction = async () => {
    setIsProcessing(true);
    try {
      switch (currentStep) {
        case 1:
          onLog("Step 1: Private Task Created. Task ID: task_compute_demo_01.", "info");
          setCurrentStep(2);
          break;

        case 2:
          onLog("Step 2: Policy Defined: Max 10 DUST, Per-tx 3 DUST, Category COMPUTE.", "info");
          setCurrentStep(3);
          break;

        case 3:
          onLog("Step 3: Policy Commitment anchored cryptographically. Agent granted capability token.", "success");
          setCurrentStep(4);
          break;

        case 4:
          onLog("Step 4: Compute Service selected: 'Secure Enclave Compute Node' (srv_compute_alpha).", "info");
          setCurrentStep(5);
          break;

        case 5: {
          onLog("Step 5: Agent requesting procurement under TaskPolicy...", "info");
          const record = await pactraUiService.procureComputeJob({
            jobId: `job_comp_${Date.now().toString(36)}`,
            serviceId: "srv_compute_alpha",
            instructions: "Execute confidential matrix decomposition in SGX enclave",
            inputDatasetHash: "0xinput_matrix_norm_a91b4",
            maxDurationSeconds: 30,
          });
          setProcurementRecord(record);
          onLog(`Step 5 Complete: Policy approved procurement ${record.procurementId}. Reserved 3 DUST.`, "success");
          setCurrentStep(6);
          break;
        }

        case 6:
          onLog("Step 6: Escrow reserved: 3 DUST committed. Escrow state transitioned to ACTIVE.", "info");
          setCurrentStep(7);
          break;

        case 7: {
          if (!procurementRecord) {
            throw new Error("No active procurement record found. Please restart from Step 5.");
          }
          onLog("Step 7: Enclave executing workload. Generating cryptographic evidence package...", "info");
          const ev = await pactraUiService.executeProcurement(
            procurementRecord.procurementId,
            simulateFailure ? "INVALID_EVIDENCE" : undefined
          );
          setEvidence(ev);
          onLog(`Step 7 Complete: Received execution evidence from ${ev.providerCommitment.slice(0, 16)}...`, "success");
          setCurrentStep(8);
          break;
        }

        case 8: {
          if (!evidence) {
            throw new Error("No evidence found. Please complete Step 7 first.");
          }
          onLog("Step 8: Verifying execution evidence against objective condition commitment...", "info");
          const vRes = pactraUiService.verifyCompletion(evidence, simulateFailure);
          setVerificationResult(vRes);
          if (vRes.verified) {
            onLog("Step 8 Complete: Evidence cryptographically VERIFIED! Escrow ready for settlement.", "success");
          } else {
            onLog(`Step 8 Alert: Verification FAILED (${vRes.failureReason}). Escrow ready for REFUND.`, "error");
          }
          setCurrentStep(9);
          break;
        }

        case 9: {
          if (verificationResult?.verified) {
            onLog("Step 9: Payout released to Provider! 3 DUST settled. Remaining budget: 7 DUST.", "success");
            setSettled(true);
          } else {
            onLog("Step 9: Refund processed! 3 DUST returned to user treasury due to invalid evidence.", "info");
            setSettled(true);
          }
          break;
        }

        default:
          break;
      }
    } catch (err: any) {
      onLog(`Action error in Step ${currentStep}: ${err.message}`, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCurrentStep(1);
    setProcurementRecord(null);
    setEvidence(null);
    setVerificationResult(null);
    setSettled(false);
    setSimulateFailure(false);
    onLog("Compute Guided Walkthrough reset to Step 1.", "info");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Overview Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(112, 69, 255, 0.12) 100%)",
          border: "1px solid var(--border-cyan)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "24px" }}>⚡</span>
              <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-main)" }}>
                End-to-End COMPUTE Service Walkthrough
              </h2>
              <span
                style={{
                  background: "rgba(0, 240, 255, 0.15)",
                  color: "var(--cyan)",
                  border: "1px solid rgba(0, 240, 255, 0.3)",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                }}
              >
                PRIMARY MVP PATH
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "800px", lineHeight: "1.6" }}>
              Experience the core Pactra lifecycle step-by-step: giving an autonomous agent bounded economic authority to discover, procure, and settle a secure compute workload without ever exposing your wallet private key or treasury.
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={handleReset}
            style={{ padding: "8px 16px", fontSize: "12px" }}
          >
            🔄 Reset Walkthrough
          </button>
        </div>

        {/* 9-Step Visual Stepper */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
            gap: "8px",
            marginTop: "24px",
          }}
        >
          {STEPS.map((s) => {
            const isCompleted = s.number < currentStep || (currentStep === 9 && settled);
            const isCurrent = s.number === currentStep && !(currentStep === 9 && settled);

            return (
              <div
                key={s.number}
                onClick={() => {
                  if (s.number <= currentStep) {
                    // allow reviewing earlier completed steps
                  }
                }}
                style={{
                  padding: "10px 8px",
                  borderRadius: "var(--radius-sm)",
                  background: isCurrent
                    ? "rgba(0, 240, 255, 0.15)"
                    : isCompleted
                    ? "rgba(0, 230, 153, 0.12)"
                    : "rgba(255, 255, 255, 0.03)",
                  border: isCurrent
                    ? "1px solid var(--cyan)"
                    : isCompleted
                    ? "1px solid var(--emerald)"
                    : "1px solid var(--border-subtle)",
                  textAlign: "center",
                  transition: "var(--transition)",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: isCurrent
                      ? "var(--cyan)"
                      : isCompleted
                      ? "var(--emerald)"
                      : "var(--text-dim)",
                    marginBottom: "4px",
                  }}
                >
                  {isCompleted ? "✓ " : ""}{s.number}
                </div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: isCurrent ? "var(--text-main)" : isCompleted ? "var(--text-main)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={s.title}
                >
                  {s.title.split(". ")[1]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Step Interactive Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-lg)",
          padding: "26px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "var(--cyan)",
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              Step {activeStepInfo.number} of 9
            </span>
            <h3 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-main)", marginTop: "4px" }}>
              {activeStepInfo.title}
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "6px" }}>
              {activeStepInfo.shortDesc}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {currentStep === 7 && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--amber)",
                  background: "rgba(255, 170, 0, 0.1)",
                  border: "1px solid rgba(255, 170, 0, 0.3)",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => setSimulateFailure(e.target.checked)}
                />
                Simulate Corrupted Evidence (Test Refund Branch)
              </label>
            )}

            <button
              className="btn-primary"
              disabled={isProcessing || (currentStep === 9 && settled)}
              onClick={handleStepAction}
              style={{
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 700,
                boxShadow: "0 0 16px rgba(112, 69, 255, 0.35)",
              }}
            >
              {isProcessing
                ? "Processing..."
                : currentStep === 9 && settled
                ? "✓ Flow Completed"
                : currentStep === 9
                ? (verificationResult?.verified ? "Execute Settlement Release" : "Execute Refund to Creator")
                : `Execute Step ${currentStep} →`}
            </button>
          </div>
        </div>

        {/* Privacy Boundary Comparison for this Step */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginTop: "10px",
          }}
        >
          {/* Shielded / Off-Chain Private State */}
          <div
            style={{
              background: "rgba(112, 69, 255, 0.08)",
              border: "1px solid rgba(112, 69, 255, 0.3)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px" }}>🛡️</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary-glow)" }}>
                Shielded / Private Witness Data
              </span>
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeStepInfo.shielded.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: "13px",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "var(--primary-glow)", fontSize: "10px" }}>●</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Public / Observable Ledger State */}
          <div
            style={{
              background: "rgba(0, 240, 255, 0.06)",
              border: "1px solid rgba(0, 240, 255, 0.25)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px" }}>🌐</span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--cyan)" }}>
                Public / Observable Ledger State
              </span>
            </div>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
              {activeStepInfo.observable.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    fontSize: "13px",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "var(--cyan)", fontSize: "10px" }}>●</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Live Step Artifacts / Details Box */}
        <div
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "16px",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-dim)", marginBottom: "10px" }}>
            LIVE CRYPTOGRAPHIC ARTIFACTS & RESOLVED STATE
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              color: "var(--text-main)",
            }}
          >
            <div>
              <span style={{ color: "var(--text-muted)" }}>Target Service: </span>
              <span style={{ color: "var(--cyan)" }}>srv_compute_alpha</span>
              <span style={{ color: "var(--text-dim)" }}> (Secure Enclave Compute Node • 3 DUST)</span>
            </div>

            {procurementRecord && (
              <>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Procurement ID: </span>
                  <span style={{ color: "var(--emerald)" }}>{procurementRecord.procurementId}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Capability Auth Token: </span>
                  <span style={{ color: "var(--text-main)" }}>
                    {procurementRecord.authToken?.authorizationId || "auth_pre_approved_token"}
                  </span>
                </div>
              </>
            )}

            {evidence && (
              <>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Execution Attestation / Signature: </span>
                  <span style={{ color: "var(--amber)" }}>
                    {evidence.evidenceSignature}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Output Commitment: </span>
                  <span style={{ color: "var(--text-main)" }}>{evidence.outputHash}</span>
                </div>
              </>
            )}

            {verificationResult && (
              <div>
                <span style={{ color: "var(--text-muted)" }}>Verifier Decision: </span>
                <span
                  style={{
                    color: verificationResult.verified ? "var(--emerald)" : "var(--crimson)",
                    fontWeight: 700,
                  }}
                >
                  {verificationResult.verified ? "VERIFIED (PASSED)" : `REJECTED (${verificationResult.failureReason})`}
                </span>
              </div>
            )}

            {settled && (
              <div
                style={{
                  marginTop: "6px",
                  padding: "10px",
                  background: verificationResult?.verified ? "rgba(0, 230, 153, 0.1)" : "rgba(255, 51, 102, 0.1)",
                  border: `1px solid ${verificationResult?.verified ? "var(--emerald)" : "var(--crimson)"}`,
                  borderRadius: "var(--radius-sm)",
                  color: verificationResult?.verified ? "var(--emerald)" : "var(--crimson)",
                  fontWeight: 700,
                }}
              >
                {verificationResult?.verified
                  ? "✓ Escrow Successfully Settled! 3 DUST transferred to provider. Task marked complete."
                  : "✓ Escrow Refunded to Creator! 3 DUST returned to user treasury due to failed verification."}
              </div>
            )}
          </div>
        </div>

        {/* Security Affirmation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "12px",
            color: "var(--emerald)",
            background: "rgba(0, 230, 153, 0.08)",
            border: "1px solid rgba(0, 230, 153, 0.25)",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <span>🔒</span>
          <span>
            <strong>Pactra Security Invariant:</strong> At no point in this 9-step flow did the agent receive your wallet seed phrase, private key, or unrestricted balance. All authority was bounded by the cryptographic policy commitment.
          </span>
        </div>
      </div>
    </div>
  );
};
