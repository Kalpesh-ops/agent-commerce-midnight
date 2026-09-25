import React, { useState, useEffect } from "react";
import { telemetryService, AggregateProductMetrics } from "../services/telemetryService";
import { feedbackService } from "../services/feedbackService";
import { EscrowContractData } from "../services/escrowService";
import { Hash, Tag } from "./ui";

interface ProductMetricsViewProps {
  escrowState: EscrowContractData;
  isIndexerLive: boolean;
}

export const ProductMetricsView: React.FC<ProductMetricsViewProps> = ({ escrowState, isIndexerLive }) => {
  const [metrics, setMetrics] = useState<AggregateProductMetrics>(telemetryService.getAggregateMetrics());
  const feedbackList = feedbackService.getFeedbackList();
  const avgRating = feedbackService.getAverageRating();

  useEffect(() => {
    const interval = setInterval(() => setMetrics(telemetryService.getAggregateMetrics()), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section>
      <p className="muted" style={{ maxWidth: "68ch", marginBottom: 20 }}>
        Two columns, kept apart on purpose. The left is read from Midnight or your wallet. The right counts what happened in
        this browser's simulation. Nothing here is estimated or padded, and it only counts this device.
      </p>

      <div className="ruled-2">
        <div className="sheet-body">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="sub">On Preprod</h3>
            <Tag tone={isIndexerLive ? "ok" : "warn"}>{isIndexerLive ? "Indexer synced" : "Indexer offline"}</Tag>
          </div>
          <dl className="kv">
            <dt>Network</dt>
            <dd>Midnight Preprod</dd>
            <dt>Contract</dt>
            <dd>
              <Hash value={escrowState.contractAddress} empty="None deployed" />
            </dd>
            <dt>Escrow balance</dt>
            <dd>{escrowState.escrowedAmount} DUST</dd>
            <dt>Wallet sessions</dt>
            <dd>{metrics.walletConnections}</dd>
            <dt>Feedback entries</dt>
            <dd>
              {feedbackList.length}
              {avgRating > 0 && <span className="faint"> (avg {avgRating} of 5)</span>}
            </dd>
          </dl>
        </div>
        <div className="sheet-body">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 className="sub">In simulation</h3>
            <Tag tone="warn">Local only</Tag>
          </div>
          <dl className="kv">
            <dt>Walkthrough runs</dt>
            <dd>{metrics.onboardingCompletions}</dd>
            <dt>Purchases attempted</dt>
            <dd>{metrics.procurementsCompleted}</dd>
            <dt>Verifications</dt>
            <dd>
              {metrics.verificationsPassed} passed, {metrics.verificationsFailed} failed
            </dd>
            <dt>Settled / refunded</dt>
            <dd>
              {metrics.settlements} / {metrics.refunds}
            </dd>
            <dt>Errors handled</dt>
            <dd className={metrics.errorCount > 0 ? "c-bad" : ""}>{metrics.errorCount}</dd>
          </dl>
        </div>
      </div>

      <div className="sheet" style={{ marginTop: 24 }}>
        <div className="sheet-body row-between">
          <div>
            <h3 className="sub">External tester goal</h3>
            <p className="small muted">50 people testing on Preprod. Counted from feedback on this device.</p>
          </div>
          <div className="figure">
            {feedbackList.length}
            <span className="figure-unit">of 50</span>
          </div>
        </div>
        <div style={{ height: 6, background: "var(--paper-2)", borderTop: "1px solid var(--rule)" }}>
          <div style={{ height: "100%", width: `${Math.min(100, (feedbackList.length / 50) * 100)}%`, background: "var(--ink)" }} />
        </div>
      </div>
    </section>
  );
};
