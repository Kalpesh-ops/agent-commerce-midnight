import React from "react";
import { UiEnvironmentConfig } from "../config/network";
import { Tag } from "./ui";

interface NetworkBadgeProps {
  currentEnv: UiEnvironmentConfig;
  detectedWalletNetwork?: string | null;
  onSwitchEnv?: (envId: "LOCAL" | "PREPROD" | "MAINNET") => void;
}

export const NetworkBadge: React.FC<NetworkBadgeProps> = ({ currentEnv, detectedWalletNetwork, onSwitchEnv }) => {
  const isMismatch =
    Boolean(detectedWalletNetwork) &&
    ((currentEnv.id === "MAINNET" && !detectedWalletNetwork?.toLowerCase().includes("mainnet")) ||
      (currentEnv.id === "PREPROD" &&
        !detectedWalletNetwork?.toLowerCase().includes("testnet") &&
        !detectedWalletNetwork?.toLowerCase().includes("preprod")));

  return (
    <div className="row">
      {onSwitchEnv ? (
        <label>
          <span className="sr-only">Environment</span>
          <select
            className="select"
            style={{ width: "auto", minHeight: 32, fontSize: 13 }}
            value={currentEnv.id}
            onChange={(e) => onSwitchEnv(e.target.value as "LOCAL" | "PREPROD" | "MAINNET")}
          >
            <option value="PREPROD">Preprod testnet</option>
            <option value="LOCAL">Local sandbox</option>
            <option value="MAINNET">Mainnet</option>
          </select>
        </label>
      ) : (
        <Tag tone={currentEnv.isProduction ? "ok" : "plain"}>{currentEnv.badgeText}</Tag>
      )}

      {isMismatch && (
        <Tag tone="bad" title={`Wallet network "${detectedWalletNetwork}" does not match "${currentEnv.label}".`}>
          Wallet on {detectedWalletNetwork}
        </Tag>
      )}
    </div>
  );
};
