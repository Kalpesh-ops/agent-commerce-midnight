import React from "react";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGuide: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartGuide,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(5, 7, 15, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-glow)",
          borderRadius: "var(--radius-lg)",
          maxWidth: "640px",
          width: "100%",
          padding: "30px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(112, 69, 255, 0.2)",
          animation: "fadeIn 0.25s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h2 style={{ fontSize: "20px", margin: 0, color: "var(--text-main)" }}>
                Welcome to Pactra
              </h2>
              <span
                style={{
                  background: "rgba(255, 170, 0, 0.15)",
                  color: "#ffaa00",
                  border: "1px solid rgba(255, 170, 0, 0.4)",
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: 800,
                  letterSpacing: "0.5px",
                }}
              >
                PREPROD / TESTNET
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--cyan)", fontWeight: 600 }}>
              "Give an agent a goal and bounded economic authority — not your wallet."
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "20px" }}>
          Pactra is the first privacy-preserving economic operating system for autonomous AI agents built on the <strong>Midnight Network</strong>. It eliminates the risk of prompt-injection treasury drains by enforcing zero-knowledge policy boundaries.
        </p>

        {/* 4 Pillars Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
          <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ color: "var(--emerald)", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
              1. Zero Key Custody
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Agents never touch your private keys, seed phrases, or user treasury balance.
            </div>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ color: "var(--cyan)", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
              2. Bounded Escrow
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Spending is hard-capped on-chain per task and per micro-transaction.
            </div>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ color: "var(--purple-bright)", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
              3. ZK Privacy
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Prompts, strategies, and spending policies stay shielded in witness memory.
            </div>
          </div>

          <div style={{ background: "rgba(0, 0, 0, 0.3)", padding: "12px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <div style={{ color: "var(--emerald)", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
              4. Verifiable Settlement
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              Funds release only when cryptographic proof of task completion is verified.
            </div>
          </div>
        </div>

        {/* Lace Preprod Notice */}
        <div
          style={{
            background: "rgba(112, 69, 255, 0.12)",
            border: "1px solid rgba(112, 69, 255, 0.3)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
            fontSize: "12px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px" }}>💡</span>
          <div>
            To test real on-chain transactions, connect the <strong>Midnight Lace Wallet</strong> set to <strong>Preprod</strong>. Need test tokens? Visit the{" "}
            <a
              href="https://midnight-tmnight-preprod.nethermind.dev/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--cyan)", textDecoration: "underline" }}
            >
              Nethermind Faucet
            </a>.
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: "8px 16px", fontSize: "13px" }}
          >
            Explore Dashboard
          </button>
          <button
            className="btn-action primary"
            onClick={() => {
              onClose();
              onStartGuide();
            }}
            style={{ padding: "8px 20px", fontSize: "13px" }}
          >
            🚀 Launch Guided Compute Demo
          </button>
        </div>
      </div>
    </div>
  );
};
