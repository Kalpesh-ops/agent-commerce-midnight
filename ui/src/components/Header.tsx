import React from "react";
import { WalletState } from "../services/wallet";
import { MidnightNetworkId } from "../types/midnight";

interface HeaderProps {
  wallet: WalletState;
  onConnect: () => void;
  onNetworkChange: (net: MidnightNetworkId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  onConnect,
  onNetworkChange,
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
