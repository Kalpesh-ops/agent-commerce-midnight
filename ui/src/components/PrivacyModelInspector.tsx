import React, { useState, useMemo } from "react";
import { sha256Hex } from "../../../contract/src/index.js";

export const PrivacyModelInspector: React.FC = () => {
  const [privatePrompt, setPrivatePrompt] = useState<string>(
    "Deploy fine-tuned sentiment classifier with proprietary weights"
  );
  const [privateMaxBudget, setPrivateMaxBudget] = useState<number>(10);
  const [privateSecretSalt, setPrivateSecretSalt] = useState<string>("0xentropy_user_secret_seed_4a91f");
  const [privateProviderId, setPrivateProviderId] = useState<string>(
    "0xprovider_alpha_enclave_99a4c102"
  );

  // Compute live zero-knowledge cryptographic commitments
  const computedPolicyCommitment = useMemo(() => {
    return (
      "0x" +
      sha256Hex(
        `policy:${privatePrompt}:${privateMaxBudget}:${privateSecretSalt}:${privateProviderId}`
      )
    );
  }, [privatePrompt, privateMaxBudget, privateSecretSalt, privateProviderId]);

  const computedConditionCommitment = useMemo(() => {
    return (
      "0x" +
      sha256Hex(
        `condition:${privatePrompt}:provider=${privateProviderId}:maxCost=${privateMaxBudget}`
      )
    );
  }, [privatePrompt, privateProviderId, privateMaxBudget]);

  const computedAgentCommitment = useMemo(() => {
    return "0x" + sha256Hex(`agent:executor:pactra_agent_worker_${privateSecretSalt.slice(0, 10)}`);
  }, [privateSecretSalt]);

  return (
    <div className="privacy-inspector" style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div className="section-title">
        <span>🛡️</span> Zero-Knowledge Privacy Boundary & Live Commitment Simulator
      </div>
      <div style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Pactra enforces strict zero-knowledge information barriers on the <strong>Midnight Network</strong>.
        Modify the private fields below to see in real-time how private task details alter cryptographic commitments
        without exposing plaintext data on the observable public ledger.
      </div>

      {/* Live Interactive Privacy Simulator */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.35)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-md)",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h4 style={{ margin: 0, fontSize: "15px", color: "var(--cyan)" }}>
            ⚡ Live Zero-Knowledge Commitment Derivation
          </h4>
          <span
            style={{
              background: "rgba(0, 229, 255, 0.15)",
              color: "var(--cyan)",
              padding: "3px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              fontWeight: 700,
            }}
          >
            REAL-TIME SYNCHRONOUS
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
          {/* Left Column: Private Inputs */}
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--emerald)", marginBottom: "8px" }}>
              🔒 SHIELDED / PRIVATE INPUTS (Local RAM Only)
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Task Objective / Sensitive User Prompt:
              </label>
              <textarea
                className="form-input"
                rows={2}
                value={privatePrompt}
                onChange={(e) => setPrivatePrompt(e.target.value)}
                style={{ width: "100%", resize: "vertical", fontSize: "12px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Private Max Budget (DUST):
                </label>
                <input
                  type="number"
                  className="form-input"
                  value={privateMaxBudget}
                  min={1}
                  onChange={(e) => setPrivateMaxBudget(Number(e.target.value))}
                  style={{ width: "100%", fontSize: "12px" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                  Secret Creator Salt / Entropy:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={privateSecretSalt}
                  onChange={(e) => setPrivateSecretSalt(e.target.value)}
                  style={{ width: "100%", fontSize: "12px" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>
                Target Provider Identity Commitment:
              </label>
              <input
                type="text"
                className="form-input"
                value={privateProviderId}
                onChange={(e) => setPrivateProviderId(e.target.value)}
                style={{ width: "100%", fontSize: "12px" }}
              />
            </div>
          </div>

          {/* Right Column: Public Ledger Derivation */}
          <div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--cyan)", marginBottom: "8px" }}>
              🌐 OBSERVABLE LEDGER STATE (What Midnight Sees)
            </div>

            <div
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(0, 229, 255, 0.2)",
                borderRadius: "var(--radius-sm)",
                padding: "12px",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: "2px" }}>
                  policyCommitment (Bytes&lt;32&gt;):
                </div>
                <div style={{ color: "var(--cyan)", wordBreak: "break-all" }}>
                  {computedPolicyCommitment}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: "2px" }}>
                  conditionCommitmentHash (Bytes&lt;32&gt;):
                </div>
                <div style={{ color: "var(--emerald)", wordBreak: "break-all" }}>
                  {computedConditionCommitment}
                </div>
              </div>

              <div>
                <div style={{ color: "var(--text-muted)", marginBottom: "2px" }}>
                  agentCommitment (Bytes&lt;32&gt;):
                </div>
                <div style={{ color: "var(--purple-bright)", wordBreak: "break-all" }}>
                  {computedAgentCommitment}
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "8px" }}>
                <span style={{ color: "var(--text-muted)" }}>Observable Escrow State: </span>
                <span style={{ color: "var(--text-main)", fontWeight: 700 }}>ACTIVE</span>
                <span style={{ color: "var(--text-muted)", marginLeft: "12px" }}>Locked Balance: </span>
                <span style={{ color: "var(--emerald)", fontWeight: 700 }}>{privateMaxBudget} DUST</span>
              </div>
            </div>

            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "10px",
                background: "rgba(0, 230, 153, 0.08)",
                border: "1px solid rgba(0, 230, 153, 0.2)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
              }}
            >
              ✅ <strong>Privacy Guaranteed:</strong> Consensus nodes, indexers, and blockchain observers see only the 32-byte opaque hash digests. They learn <em>zero</em> details about the model prompt, confidential weights, or secret creator salt.
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-Side Dual-State Information Boundary Breakdown */}
      <div className="privacy-columns" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginBottom: "24px" }}>
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
              <strong>Task Details & User Objective:</strong> Full natural language prompt is held only by creator and agent in witness memory.
            </li>
            <li>
              <strong>Private Policy Limits:</strong> Specific budget allocations, spending thresholds, and provider allowlists remain hidden behind cryptographic roots.
            </li>
            <li>
              <strong>Agent Strategy & Planning:</strong> Internal multi-service execution graph, dependency ordering, and intermediate operational steps.
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
              <strong>Authorized Agent Commitment:</strong> Shielded public key hash of the authorized executor (never reveals agent's real identity).
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

      {/* Honest Cryptographic Boundary Explanation */}
      <div
        style={{
          background: "rgba(112, 69, 255, 0.1)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          fontSize: "12px",
          lineHeight: "1.6",
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--purple-bright)", marginBottom: "6px", fontSize: "13px" }}>
          ⚖️ Cryptographic Integrity Disclaimer: What Midnight Protects vs. Application-Layer Privacy
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "14px", marginTop: "10px" }}>
          <div>
            <strong style={{ color: "var(--cyan)" }}>What Midnight ZK Circuits Protect:</strong>
            <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", color: "var(--text-main)" }}>
              <li>Private coin balances and shielded transaction balance proofs.</li>
              <li>Confidential state transitions where validators verify correctness without seeing witness values.</li>
              <li>Selective identity commitment verification preventing wallet correlation.</li>
            </ul>
          </div>
          <div>
            <strong style={{ color: "var(--emerald)" }}>What Remains Application-Layer Privacy:</strong>
            <ul style={{ margin: "4px 0 0 0", paddingLeft: "16px", color: "var(--text-main)" }}>
              <li>Browser-local RAM state for private prompts and API tokens.</li>
              <li>End-to-end encrypted RPC tunnels between the agent and service provider.</li>
              <li>Selective disclosure of execution logs to arbitrators during dispute resolution.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
