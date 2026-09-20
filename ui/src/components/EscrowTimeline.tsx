import React from "react";
import { TaskStateName, SettlementStateName } from "../services/escrowService";

interface EscrowTimelineProps {
  taskState: TaskStateName;
  settlementState: SettlementStateName;
}

const STEPS: { key: TaskStateName; label: string; index: number }[] = [
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
      <div className="section-title">
        <span>🔄</span> Escrow State Machine Lifecycle
      </div>

      <div className="timeline-steps">
        <div className="step-connector"></div>

        {STEPS.map((step) => {
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
