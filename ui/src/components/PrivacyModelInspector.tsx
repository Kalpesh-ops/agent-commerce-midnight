import React from "react";

export const PrivacyModelInspector: React.FC = () => {
  return (
    <div className="privacy-inspector">
      <div className="section-title">
        <span>🛡️</span> Midnight Privacy & Security Architecture
      </div>

      <div className="privacy-columns">
        <div className="privacy-box public">
          <h4>
            <span>🌐</span> Observable On-Chain Ledger
          </h4>
          <ul className="privacy-list">
            <li><strong>Task ID:</strong> Opaque 32-byte cryptographic identifier</li>
            <li><strong>Creator Commitment:</strong> ZK identity commitment (not raw address)</li>
            <li><strong>Agent Commitment:</strong> Authorized agent identity commitment</li>
            <li><strong>Max Budget:</strong> Upper-bound spending envelope limit</li>
            <li><strong>Escrowed Balance:</strong> Allocated locked funds</li>
            <li><strong>Lifecycle State:</strong> State enum for coordination</li>
            <li><strong>Condition & Evidence Hashes:</strong> Merkle / SHA-256 commitments</li>
          </ul>
        </div>

        <div className="privacy-box private">
          <h4>
            <span>🔒</span> Shielded Zero-Knowledge Private State
          </h4>
          <ul className="privacy-list">
            <li><strong>Creator Secret Key:</strong> Kept strictly inside local witness context</li>
            <li><strong>Agent Secret Key:</strong> Autonomous execution credentials</li>
            <li><strong>Task Details & Prompts:</strong> Kept off-chain in private agent memory</li>
            <li><strong>Objective Criteria:</strong> Verified locally without leaking prompt logic</li>
            <li><strong>Treasury Isolation:</strong> Agent receives <strong>ZERO</strong> direct treasury access</li>
            <li><strong>Double-Spend Immunity:</strong> ZK circuits enforce strict single-settlement</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
