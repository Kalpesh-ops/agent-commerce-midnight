import React, { useState } from "react";

interface SafetyBannerProps {
  onDismiss?: () => void;
}

export const SafetyBanner: React.FC<SafetyBannerProps> = ({ onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("pactra_safety_dismissed") === "true";
    } catch {
      return false;
    }
  });

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("pactra_safety_dismissed", "true");
    } catch {
      // ignore
    }
    if (onDismiss) onDismiss();
  };

  return (
    <div
      id="pactra-safety-banner"
      style={{
        background: "linear-gradient(135deg, rgba(255, 170, 0, 0.12) 0%, rgba(112, 69, 255, 0.1) 100%)",
        border: "1px solid rgba(255, 170, 0, 0.4)",
        borderRadius: "var(--radius-md)",
        padding: "14px 18px",
        marginBottom: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "14px",
      }}
    >
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <span style={{ fontSize: "20px", marginTop: "2px" }}>🛡️</span>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <strong style={{ fontSize: "13px", color: "var(--amber)", letterSpacing: "0.5px" }}>
              MIDNIGHT PREPROD TESTNET • TESTER SAFETY ADVISORY
            </strong>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                background: "rgba(255, 170, 0, 0.2)",
                color: "var(--amber)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              ZERO REAL FUNDS
            </span>
          </div>

          <p style={{ fontSize: "12px", color: "var(--text-main)", marginTop: "4px", lineHeight: "1.5" }}>
            You are interacting with the <strong>Midnight Preprod Testnet</strong>. Testnet tokens (DUST / tNIGHT) hold no economic value and are provided freely via the faucet. Always use a <strong>dedicated testnet wallet</strong>. <em>Never enter private keys or recovery seed phrases.</em> Autonomous agents operate strictly within bounded task escrows.
          </p>

          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "8px",
              fontSize: "11px",
              color: "var(--text-muted)",
              flexWrap: "wrap",
            }}
          >
            <span>🔒 <strong>Bounded Sandbox:</strong> Max liability capped to escrow</span>
            <span>💧 <strong>Free Faucet:</strong> Available on Nethermind</span>
            <span>🚫 <strong>Zero Key Custody:</strong> Keys never shared with agent</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: "16px",
          padding: "4px",
          lineHeight: 1,
        }}
        title="Dismiss notice for this session"
      >
        ✕
      </button>
    </div>
  );
};
