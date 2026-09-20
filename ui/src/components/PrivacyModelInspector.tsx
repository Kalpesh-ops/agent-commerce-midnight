import React from "react";

export const PrivacyModelInspector: React.FC = () => {
  return (
    <div className="privacy-inspector">
      <div className="section-title">
        <span>🛡️</span> Privacy Architecture & State Boundary Inspector
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>
        Midnight enforces strict boundaries between shielded witness secrets, public on-chain ledger records,
        ephemeral frontend state, and fallback demo states.
      </div>

      <div className="privacy-columns" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
        {/* 1. Shielded ZK State */}
        <div className="privacy-box private">
          <h4>
            <span>🔒</span> Shielded ZK Witness State
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
            Kept strictly in local memory. Never sent to ledger or wallet.
          </div>
          <ul className="privacy-list">
            <li><strong>Creator Secret Key:</strong> Kept in local witness context; proves ownership via commitment.</li>
            <li><strong>Agent Secret Key:</strong> Autonomous execution key; proves authorization without disclosing identity.</li>
            <li><strong>Task Details & Prompts:</strong> Kept off-chain in private agent memory.</li>
            <li><strong>Treasury Isolation:</strong> Mathematically verified in circuit: agent has <strong>ZERO</strong> direct treasury access.</li>
          </ul>
        </div>

        {/* 2. Observable On-Chain Ledger */}
        <div className="privacy-box public">
          <h4>
            <span>🌐</span> Observable On-Chain Ledger
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
            Recorded on Midnight Preprod blockchain. Verified by all nodes.
          </div>
          <ul className="privacy-list">
            <li><strong>Task ID:</strong> Opaque 32-byte identifier.</li>
            <li><strong>Creator & Agent Commitments:</strong> Cryptographic identity hashes (not raw public addresses).</li>
            <li><strong>Max Budget & Escrow Balance:</strong> Bounded monetary limit and locked DUST/tNIGHT.</li>
            <li><strong>State & Settlement Enums:</strong> Protocol coordination markers.</li>
            <li>
              <strong>Condition & Evidence Hashes:</strong>
              <br />
              <em style={{ color: "var(--amber)", fontSize: "11px" }}>
                ⚠️ Level 1 uses cryptographic SHA-256/Merkle commitments; automated ZK completion proof verification arrives in Level 2.
              </em>
            </li>
          </ul>
        </div>

        {/* 3. Frontend-Only State */}
        <div className="privacy-box" style={{ background: "rgba(99, 102, 241, 0.05)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
          <h4 style={{ color: "#a5b4fc" }}>
            <span>💻</span> Frontend-Only State
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
            Ephemeral browser state. Zero private-key custody.
          </div>
          <ul className="privacy-list">
            <li><strong>In-Memory Private State:</strong> Transient session storage for Compact witness parameters.</li>
            <li><strong>Tx Lifecycle Tracker:</strong> PENDING_USER_SIGNATURE → SUBMITTED → CONFIRMING.</li>
            <li><strong>Lace Extension Handle:</strong> Requests fee balancing; private keys remain secure inside Lace.</li>
            <li><strong>Indexer Query Cache:</strong> Synchronized ledger snapshot.</li>
          </ul>
        </div>

        {/* 4. Simulated / Demo-Only State */}
        <div className="privacy-box" style={{ background: "rgba(255, 170, 0, 0.05)", border: "1px solid rgba(255, 170, 0, 0.2)" }}>
          <h4 style={{ color: "var(--amber)" }}>
            <span>⚠️</span> Simulated / Demo Mode
          </h4>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px" }}>
            Local sandbox fallback when wallet or network is disconnected.
          </div>
          <ul className="privacy-list">
            <li><strong>Mock State Machine:</strong> Pure client-side React simulation.</li>
            <li><strong>Zero On-Chain Settlement:</strong> No transactions submitted to Midnight network.</li>
            <li><strong>Zero Cryptographic Finality:</strong> State resets on reload if not deployed.</li>
            <li><strong>Visual Warning:</strong> Labeled with amber badge to prevent confusion with live Preprod.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
