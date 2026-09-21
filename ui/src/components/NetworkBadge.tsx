import React from "react";
import { UiEnvironmentConfig } from "../config/network";

interface NetworkBadgeProps {
  currentEnv: UiEnvironmentConfig;
  detectedWalletNetwork?: string | null;
  onSwitchEnv?: (envId: "LOCAL" | "PREPROD" | "MAINNET") => void;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({
  currentEnv,
  detectedWalletNetwork,
  onSwitchEnv,
}) => {
  const isMismatch =
    Boolean(detectedWalletNetwork) &&
    ((currentEnv.id === "MAINNET" && !detectedWalletNetwork?.toLowerCase().includes("mainnet")) ||
      (currentEnv.id === "PREPROD" && !detectedWalletNetwork?.toLowerCase().includes("testnet") && !detectedWalletNetwork?.toLowerCase().includes("preprod")));

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          borderRadius: "20px",
          fontSize: "0.75rem",
          fontWeight: 700,
          letterSpacing: "0.05em",
          background: currentEnv.isProduction
            ? "rgba(16, 185, 129, 0.15)"
            : "rgba(168, 85, 247, 0.15)",
          color: currentEnv.color,
          border: `1px solid ${currentEnv.color}40`,
        }}
      >
        <span
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: currentEnv.color,
            boxShadow: `0 0 8px ${currentEnv.color}`,
          }}
        />
        {currentEnv.badgeText}
      </div>

      {isMismatch && (
        <span
          title={`Wallet network "${detectedWalletNetwork}" does not match configured environment "${currentEnv.label}".`}
          style={{
            fontSize: "0.72rem",
            padding: "2px 8px",
            borderRadius: "4px",
            background: "#ef444425",
            color: "#f87171",
            border: "1px solid #ef444450",
            fontWeight: 600,
          }}
        >
          ⚠️ Network Mismatch: Wallet is on {detectedWalletNetwork}
        </span>
      )}
    </div>
  );
};
