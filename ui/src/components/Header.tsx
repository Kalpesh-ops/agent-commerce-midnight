import React from "react";
import { WalletState } from "../services/wallet";
import { MidnightNetworkId } from "../types/midnight";

interface HeaderProps {
  wallet: WalletState;
  isLiveMode: boolean;
  contractAddress: string | null;
  onConnect: () => void;
  onNetworkChange: (net: MidnightNetworkId) => void;
  onModeToggle: (mode: "live" | "demo") => void;
  onContractAddressChange: (addr: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  isLiveMode,
  contractAddress,
  onConnect,
  onNetworkChange,
  onModeToggle,
  onContractAddressChange,
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo-icon">🌌</div>
        <div>
          <h1 className="brand-title">Midnight Agent Commerce</h1>
          <p className="brand-subtitle">Autonomous Escrow Protocol • Level 1</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Visual Badge distinguishing Live Preprod from Demo */}
        {isLiveMode ? (
          <div
            id="badge-live-preprod"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "rgba(0, 230, 153, 0.12)",
              border: "1px solid var(--emerald)",
              borderRadius: "var(--radius-full)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--emerald)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--emerald)",
                boxShadow: "0 0 10px var(--emerald)",
              }}
            ></span>
            LIVE PREPROD ON-CHAIN
          </div>
        ) : (
          <div
            id="badge-demo-mode"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "rgba(255, 170, 0, 0.12)",
              border: "1px solid var(--amber)",
              borderRadius: "var(--radius-full)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--amber)",
            }}
          >
            <span>⚠️</span>
            OFF-CHAIN DEMO / SIMULATION
          </div>
        )}

        <div className="network-badge">
          <span className="network-indicator-dot"></span>
          <select
            value={wallet.networkId}
            onChange={(e) => onNetworkChange(e.target.value as MidnightNetworkId)}
            style={{
              background: "transparent",
              color: "inherit",
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: "inherit",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="preprod" style={{ background: "#0d1226", color: "#f0f3ff" }}>
              Preprod Testnet
            </option>
            <option value="preview" style={{ background: "#0d1226", color: "#f0f3ff" }}>
              Preview Testnet
            </option>
            <option value="undeployed" style={{ background: "#0d1226", color: "#f0f3ff" }}>
              Undeployed (Local)
            </option>
          </select>
        </div>

        {wallet.isConnected ? (
          <button className="btn-secondary" title="Midnight Shielded Wallet Connected">
            <span style={{ color: "#00e699" }}>●</span>
            {wallet.coinPublicKey
              ? `${wallet.coinPublicKey.slice(0, 8)}...${wallet.coinPublicKey.slice(-6)}`
              : "Lace Connected"}
          </button>
        ) : (
          <button id="connect-wallet-btn" className="btn-primary" onClick={onConnect}>
            <span>🔌</span> Connect Lace Wallet
          </button>
        )}
      </div>
    </header>
  );
};
