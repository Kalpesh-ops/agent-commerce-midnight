import React from "react";
import { EscrowContractData } from "../services/escrowService";

interface TaskDetailsCardProps {
  data: EscrowContractData;
}

export const TaskDetailsCard: React.FC<TaskDetailsCardProps> = ({ data }) => {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <h3>Observable Ledger State</h3>
        <span className={`state-pill ${data.taskState}`}>{data.taskState}</span>
      </div>

      <div className="data-row">
        <span className="data-label">Task Identifier</span>
        <span className="data-value" title={data.taskId}>
          {data.taskId.length > 20 ? `${data.taskId.slice(0, 10)}...${data.taskId.slice(-8)}` : data.taskId}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Maximum Task Budget</span>
        <span className="data-value highlight-cyan">{data.maxBudget} DUST/NIGHT</span>
      </div>

      <div className="data-row">
        <span className="data-label">Escrowed Balance</span>
        <span className="data-value highlight-emerald">{data.escrowedAmount} DUST/NIGHT</span>
      </div>

      <div className="data-row">
        <span className="data-label">Creator Commitment</span>
        <span className="data-value" title={data.creatorCommitment}>
          {data.creatorCommitment.length > 20
            ? `${data.creatorCommitment.slice(0, 10)}...${data.creatorCommitment.slice(-8)}`
            : data.creatorCommitment}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Authorized Agent Commitment</span>
        <span className="data-value" title={data.agentCommitment}>
          {data.agentCommitment.length > 20
            ? `${data.agentCommitment.slice(0, 10)}...${data.agentCommitment.slice(-8)}`
            : data.agentCommitment}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Objective Condition Hash</span>
        <span className="data-value" title={data.conditionHash}>
          {data.conditionHash.length > 20
            ? `${data.conditionHash.slice(0, 10)}...${data.conditionHash.slice(-8)}`
            : data.conditionHash}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Completion Evidence Hash</span>
        <span className="data-value" title={data.completionHash}>
          {data.completionHash.length > 20
            ? `${data.completionHash.slice(0, 10)}...${data.completionHash.slice(-8)}`
            : data.completionHash}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Settlement Status</span>
        <span
          className="data-value"
          style={{
            color:
              data.settlementState === "SETTLED_SUCCESS"
                ? "var(--emerald)"
                : data.settlementState === "SETTLED_REFUND"
                ? "var(--crimson)"
                : "var(--text-muted)",
          }}
        >
          {data.settlementState}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Contract Sequence Counter</span>
        <span className="data-value">#{data.sequence}</span>
      </div>
    </div>
  );
};
