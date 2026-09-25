import React from "react";
import { TaskStateName, SettlementStateName } from "../services/escrowService";

interface EscrowTimelineProps {
  taskState: TaskStateName;
  settlementState: SettlementStateName;
}

const CONTRACT_STEPS: { key: TaskStateName; label: string; who: string }[] = [
  { key: "CREATED", label: "Created", who: "Creator sets the ceiling" },
  { key: "FUNDED", label: "Funded", who: "Creator deposits" },
  { key: "ACTIVE", label: "Active", who: "Agent accepts" },
  { key: "COMPLETION_PENDING", label: "Delivered", who: "Agent posts evidence" },
  { key: "COMPLETED", label: "Settled", who: "Creator releases payout" },
];

const ORDER: Record<TaskStateName, number> = {
  UNINITIALIZED: 0,
  CREATED: 1,
  FUNDED: 2,
  ACTIVE: 3,
  COMPLETION_PENDING: 4,
  COMPLETED: 5,
  REFUNDED: -1,
};

export const EscrowTimeline: React.FC<EscrowTimelineProps> = ({ taskState, settlementState }) => {
  const isRefunded = taskState === "REFUNDED";
  const current = ORDER[taskState];

  return (
    <div>
      <div className="rail" style={{ ["--steps" as string]: 5 }} aria-label="Escrow state">
        {CONTRACT_STEPS.map((step, i) => {
          const idx = i + 1;
          // Reached milestones are done; the next one to reach is highlighted.
          const cls = isRefunded ? "is-void" : current >= idx ? "is-done" : current + 1 === idx ? "is-current" : "";
          return (
            <div key={step.key} className={`rail-step ${cls}`} aria-current={cls === "is-current" ? "step" : undefined}>
              <span className="rail-num">{String(idx).padStart(2, "0")}</span>
              <div className="rail-name">{step.label}</div>
              <div className="rail-desc">{step.who}</div>
            </div>
          );
        })}
      </div>
      {isRefunded && (
        <div className="notice notice--bad" style={{ marginTop: 12 }}>
          <div className="notice-title">Refunded</div>
          The escrow returned its balance to the creator. Settlement state: {settlementState}.
        </div>
      )}
    </div>
  );
};
