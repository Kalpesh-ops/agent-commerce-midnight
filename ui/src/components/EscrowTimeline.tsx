import React from "react";
import { TaskStateName, SettlementStateName } from "../services/escrowService";

interface EscrowTimelineProps {
  taskState: TaskStateName;
  settlementState: SettlementStateName;
}

const LEVEL2_PIPELINE = [
  { key: "TASK", label: "Task Objective" },
  { key: "POLICY", label: "Private Policy" },
  { key: "PLAN", label: "Agent Plan" },
  { key: "PROCURE", label: "Procurement" },
  { key: "VERIFY", label: "Verification" },
  { key: "ESCROW", label: "Shielded Escrow" },
  { key: "SETTLE", label: "Settlement" },
];

const CONTRACT_STEPS: { key: TaskStateName; label: string; index: number }[] = [
  { key: "CREATED", label: "Created", index: 1 },
  { key: "FUNDED", label: "Funded", index: 2 },
  { key: "ACTIVE", label: "Active Execution", index: 3 },
  { key: "COMPLETION_PENDING", label: "Completion Pending", index: 4 },
  { key: "COMPLETED", label: "Completed & Settled", index: 5 },
];

export const EscrowTimeline: React.FC<EscrowTimelineProps> = ({
  taskState,
  settlementState,
}) => {
  const isRefunded = taskState === "REFUNDED";

  const getStepStatus = (stepKey: TaskStateName, stepIndex: number) => {
    if (isRefunded) {
      return "refunded";
    }

    const stateOrder: Record<TaskStateName, number> = {
      UNINITIALIZED: 0,
      CREATED: 1,
      FUNDED: 2,
      ACTIVE: 3,
      COMPLETION_PENDING: 4,
      COMPLETED: 5,
      REFUNDED: -1,
    };

    const currentOrder = stateOrder[taskState];

    if (currentOrder > stepIndex) return "completed";
    if (currentOrder === stepIndex) return "active";
    return "pending";
  };

  return (
    <div className="timeline-card">
      {/* Level 2 Full Protocol Architecture Pipeline */}
      <div style={{ marginBottom: "20px" }}>
        <div className="section-title" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          <span>🏛️</span> Pactra Level 2 Core Architecture: Task → Policy → Agent Plan → Procurement → Verification → Escrow → Settlement
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
          {LEVEL2_PIPELINE.map((stage, idx) => (
            <React.Fragment key={stage.key}>
              <div
                style={{
                  background: idx <= 4 ? "rgba(112, 69, 255, 0.15)" : "rgba(0, 230, 153, 0.15)",
                  border: `1px solid ${idx <= 4 ? "var(--border-glow)" : "var(--emerald)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: idx <= 4 ? "var(--cyan)" : "var(--emerald)",
                }}
              >
                {stage.label}
              </div>
              {idx < LEVEL2_PIPELINE.length - 1 && (
                <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="section-title">
        <span>🔄</span> On-Chain Midnight Escrow State Machine
      </div>

      <div className="timeline-steps">
        <div className="step-connector"></div>

        {CONTRACT_STEPS.map((step) => {
          const status = getStepStatus(step.key, step.index);
          return (
            <div key={step.key} className="timeline-step">
              <div className={`step-node ${status}`}>
                {status === "completed" ? "✓" : step.index}
              </div>
              <span className={`step-label ${status}`}>{step.label}</span>
            </div>
          );
        })}

        {isRefunded && (
          <div className="timeline-step">
            <div className="step-node refunded">✕</div>
            <span className="step-label" style={{ color: "var(--crimson)" }}>
              Refunded ({settlementState})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
