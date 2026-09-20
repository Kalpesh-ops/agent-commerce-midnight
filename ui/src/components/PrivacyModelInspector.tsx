import React from "react";

export const PrivacyModelInspector: React.FC = () => {
  return (
    <div className="privacy-inspector">
      <div className="section-title">
        <span>🛡️</span> Privacy Demonstration: Public / Observable vs Shielded / Private Boundaries
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
        Pactra enforces strict zero-knowledge information boundaries. Only state commitments are posted to the Midnight ledger, while business policies, agent strategies, and sensitive prompts remain entirely private in zero-knowledge witness state.
      </div>

      <div className="privacy-columns" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
        {/* 1. Shielded / Private State */}
        <div className="privacy-box private">
          <h4 style={{ color: "var(--emerald)" }}>
            <span>🔒</span> STRICTLY PRIVATE (Zero-Knowledge Witness State)
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
            Kept strictly in local memory and off-chain execution environments. Never published to the Midnight ledger or shared with third parties.
          </div>
          <ul className="privacy-list">
            <li>
              <strong>Task Details & User Objective:</strong> Full natural language prompt ("Deploy my application and keep it running for 24 hours.") is held only by the creator and agent.
            </li>
            <li>
              <strong>Private Policy Parameters:</strong> Specific budget allocations, spending thresholds, and provider allowlists remain hidden behind cryptographic commitments.
            </li>
            <li>
              <strong>Agent Strategy & Reasoning:</strong> Internal execution graph, dependency breakdown, and intermediate operational plans.
            </li>
            <li>
              <strong>Sensitive Service Parameters:</strong> API keys, private compute inputs, confidential dataset hashes, and unencrypted payload instructions.
            </li>
            <li>
              <strong>Private Witness Data:</strong> Creator entropy secret seeds, agent authorization proof witnesses, and ZK preimage proofs.
            </li>
          </ul>
        </div>

        {/* 2. Public / Observable State */}
        <div className="privacy-box public">
          <h4 style={{ color: "var(--cyan)" }}>
            <span>🌐</span> PUBLIC / OBSERVABLE (Midnight Preprod Ledger)
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "10px" }}>
            Recorded on the Midnight blockchain and queryable via public GraphQL indexer nodes. Verified by all consensus validators.
          </div>
          <ul className="privacy-list">
            <li>
              <strong>Task Commitment:</strong> Opaque 32-byte identifier binding the task to its cryptographic creator commitment.
            </li>
            <li>
              <strong>Authorized Agent Commitment:</strong> Shielded public key hash / commitment of the authorized executor (never reveals agent real identity).
            </li>
            <li>
              <strong>Escrow Status & Balance:</strong> Locked amount of DUST/tNIGHT allocated in the contract cell.
            </li>
            <li>
              <strong>Service Commitment:</strong> Public provider identifier hash verifying service authenticity without revealing proprietary logic.
            </li>
            <li>
              <strong>Settlement Status:</strong> State machine coordination markers (UNINITIALIZED, CREATED, FUNDED, ACTIVE, COMPLETION_PENDING, COMPLETED, REFUNDED).
            </li>
            <li>
              <strong>Proof & Result Commitments:</strong> Cryptographic SHA-256 and Poseidon digests of completion evidence and verifiable outputs.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
