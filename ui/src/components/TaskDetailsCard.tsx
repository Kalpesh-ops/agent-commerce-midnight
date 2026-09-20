import React from "react";
import { EscrowContractData } from "../services/escrowService";

interface TaskDetailsCardProps {
  data: EscrowContractData;
  onRefreshFromIndexer?: () => void;
}

export const TaskDetailsCard: React.FC<TaskDetailsCardProps> = ({
  data,
  onRefreshFromIndexer,
}) => {
  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <h3>Observable Ledger State</h3>
          <div style={{ fontSize: "12px", color: data.isSimulated ? "var(--amber)" : "var(--emerald)", marginTop: "2px" }}>
            {data.isSimulated ? "● Source: Local Testbed Simulation" : "● Source: Live Midnight Preprod Indexer"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span className={`state-pill ${data.taskState}`}>{data.taskState}</span>
          {onRefreshFromIndexer && (
            <button
              className="btn-secondary"
              style={{ padding: "4px 8px", fontSize: "11px" }}
              onClick={onRefreshFromIndexer}
              title="Query latest state from Midnight Preprod Indexer"
            >
              🔄 Refresh Indexer
            </button>
          )}
        </div>
      </div>

      <div className="data-row">
        <span className="data-label">Contract Address</span>
        <span className="data-value highlight-cyan" title={data.contractAddress || "Not deployed yet"}>
          {data.contractAddress
            ? `${data.contractAddress.slice(0, 10)}...${data.contractAddress.slice(-8)}`
            : "No Contract Deployed"}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Task Identifier</span>
        <span className="data-value" title={data.taskId}>
          {data.taskId.length > 20 ? `${data.taskId.slice(0, 10)}...${data.taskId.slice(-8)}` : data.taskId}
        </span>
      </div>

      <div className="data-row">
        <span className="data-label">Maximum Task Budget</span>
        <span className="data-value highlight-cyan">{data.maxBudget} DUST/tNIGHT</span>
      </div>

      <div className="data-row">
        <span className="data-label">Escrowed Balance</span>
        <span className="data-value highlight-emerald">{data.escrowedAmount} DUST/tNIGHT</span>
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

      {data.lastTxHash && (
        <div className="data-row">
          <span className="data-label">Confirmed On-Chain Tx</span>
          <span className="data-value highlight-emerald" title={data.lastTxHash}>
            {data.lastTxHash.slice(0, 12)}...{data.lastTxHash.slice(-8)}
          </span>
        </div>
      )}

      {data.confirmedBlock && (
        <div className="data-row">
          <span className="data-label">Block Height</span>
          <span className="data-value">Block #{data.confirmedBlock}</span>
        </div>
      )}

      <div className="data-row">
        <span className="data-label">Sequence Counter</span>
        <span className="data-value">#{data.sequence}</span>
      </div>
    </div>
  );
};
