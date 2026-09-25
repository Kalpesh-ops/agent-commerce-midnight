import React from "react";
import { EscrowContractData } from "../services/escrowService";
import { Hash, Skeleton, Tag } from "./ui";

interface TaskDetailsCardProps {
  data: EscrowContractData;
  isSyncing?: boolean;
  onRefreshFromIndexer?: () => void;
}

const STATE_LABEL: Record<string, string> = {
  UNINITIALIZED: "Not started",
  CREATED: "Created",
  FUNDED: "Funded",
  ACTIVE: "Active",
  COMPLETION_PENDING: "Delivered",
  COMPLETED: "Settled",
  REFUNDED: "Refunded",
};

const STATE_TONE: Record<string, "ok" | "warn" | "bad" | "seal" | "plain"> = {
  UNINITIALIZED: "plain",
  CREATED: "plain",
  FUNDED: "seal",
  ACTIVE: "seal",
  COMPLETION_PENDING: "warn",
  COMPLETED: "ok",
  REFUNDED: "bad",
};

export const TaskDetailsCard: React.FC<TaskDetailsCardProps> = ({ data, isSyncing, onRefreshFromIndexer }) => {
  const settlementTone =
    data.settlementState === "SETTLED_SUCCESS" ? "c-ok" : data.settlementState === "SETTLED_REFUND" ? "c-bad" : "faint";

  return (
    <section className="sheet" aria-labelledby="ledger-title">
      <div className="sheet-head">
        <div>
          <h3 className="sub" id="ledger-title">
            Ledger
          </h3>
          <div className="tiny faint">
            {data.contractAddress && !data.isSimulated ? "From the Midnight Preprod indexer" : "From the local simulation"}
          </div>
        </div>
        <div className="row">
          <Tag tone={STATE_TONE[data.taskState]}>{STATE_LABEL[data.taskState]}</Tag>
          {onRefreshFromIndexer && (
            <button className="btn btn--sm btn--quiet" onClick={onRefreshFromIndexer} disabled={isSyncing}>
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
          )}
        </div>
      </div>

      <div className="strip" style={{ border: 0, borderBottom: "1px solid var(--rule)" }}>
        <div>
          <div className="strip-label">Held in escrow</div>
          {isSyncing ? (
            <Skeleton lines={1} widths={["60%"]} />
          ) : (
            <div className="figure">
              {data.escrowedAmount}
              <span className="figure-unit">DUST</span>
            </div>
          )}
        </div>
        <div>
          <div className="strip-label">Budget ceiling</div>
          {isSyncing ? (
            <Skeleton lines={1} widths={["50%"]} />
          ) : (
            <div className="figure">
              {data.maxBudget}
              <span className="figure-unit">DUST</span>
            </div>
          )}
        </div>
      </div>

      <div className="sheet-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {isSyncing ? (
          <div style={{ padding: "12px 0" }}>
            <Skeleton lines={6} />
          </div>
        ) : (
          <dl className="kv">
            <dt>Contract</dt>
            <dd>
              <Hash value={data.contractAddress} empty="Not deployed" />
            </dd>
            <dt>Task id</dt>
            <dd>
              <Hash value={data.taskId} />
            </dd>
            <dt>Creator commitment</dt>
            <dd>
              <Hash value={data.creatorCommitment} />
            </dd>
            <dt>Agent commitment</dt>
            <dd>
              <Hash value={data.agentCommitment} />
            </dd>
            <dt>Condition hash</dt>
            <dd>
              <Hash value={data.conditionHash} />
            </dd>
            <dt>Evidence hash</dt>
            <dd>
              <Hash value={data.completionHash} />
            </dd>
            <dt>Settlement</dt>
            <dd className={settlementTone}>{data.settlementState.replace(/_/g, " ").toLowerCase()}</dd>
            {data.lastTxHash && (
              <>
                <dt>Last transaction</dt>
                <dd>
                  <Hash value={data.lastTxHash} />
                </dd>
              </>
            )}
            {data.confirmedBlock && (
              <>
                <dt>Block</dt>
                <dd className="hash">#{data.confirmedBlock}</dd>
              </>
            )}
            <dt>Sequence</dt>
            <dd className="hash">#{data.sequence}</dd>
          </dl>
        )}
      </div>
    </section>
  );
};
