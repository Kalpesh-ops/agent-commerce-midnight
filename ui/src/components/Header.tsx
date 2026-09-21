import React from "react";
import { WalletState } from "../services/wallet";
import { MidnightNetworkId } from "../types/midnight";

interface HeaderProps {
  wallet: WalletState;
  isLiveMode: boolean;
  contractAddress?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onNetworkChange: (net: MidnightNetworkId) => void;
  onModeToggle: (mode: "live" | "demo") => void;
  onContractAddressChange: (addr: string) => void;
  onOpenGuide?: () => void;
  onOpenFeedback?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  isLiveMode,
  contractAddress,
  onConnect,
  onDisconnect,
  onNetworkChange,
  onModeToggle,
  onOpenGuide,
  onOpenFeedback,
}) => {
  const isConnecting = wallet.status === "CONNECTING";
  const isDetecting = wallet.status === "DETECTING";

  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo-icon">🌌</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <h1 className="brand-title">Pactra</h1>
            <span
              style={{
                background: "rgba(255, 170, 0, 0.15)",
                color: "var(--amber)",
                border: "1px solid rgba(255, 170, 0, 0.3)",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 800,
                padding: "2px 6px",
                letterSpacing: "0.5px",
              }}
            >
              PREPROD TESTNET
            </span>
            <span
              style={{
                fontSize: "10px",
                color: "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                background: "rgba(255, 255, 255, 0.04)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              v0.6.0-eclipse
            </span>
          </div>
          <p className="brand-subtitle">Autonomous Agent Commerce & Escrow Protocol • Preprod MVP</p>
        </div>
      </div>

      <div className="header-actions">
        {onOpenGuide && (
          <button
            className="btn-secondary"
            onClick={onOpenGuide}
            style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            title="Open Pactra user guide & architecture primer"
          >
            <span>📖</span> Guide
          </button>
        )}
        {onOpenFeedback && (
          <button
            className="btn-secondary"
            onClick={onOpenFeedback}
            style={{ padding: "6px 12px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            title="Submit tester feedback & bug reports"
          >
            <span>💬</span> Feedback
          </button>
        )}
        {/* Visual Badge: strictly distinguishing Live Preprod from Demo */}
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
        ) : wallet.isConnected && wallet.networkId === "preprod" && !contractAddress ? (
          <div
            id="badge-preprod-ready"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 14px",
              background: "rgba(0, 212, 255, 0.12)",
              border: "1px solid var(--cyan)",
              borderRadius: "var(--radius-full)",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--cyan)",
            }}
          >
            <span>🔗</span>
            PREPROD (AWAITING DEPLOYMENT)
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

        {/* Network selector */}
        <div className="network-badge">
          <span className="network-indicator-dot"></span>
          <select
            value={wallet.networkId}
            disabled={isConnecting}
            onChange={(e) => onNetworkChange(e.target.value as MidnightNetworkId)}
            style={{
              background: "transparent",
              color: "inherit",
              border: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              fontWeight: "inherit",
              cursor: isConnecting ? "not-allowed" : "pointer",
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

        {/* Deterministic Wallet Connection Controls */}
        {wallet.isConnected ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <button
              id="wallet-connected-btn"
              className="btn-secondary"
              title={`Shielded Coin PK: ${wallet.coinPublicKey || "N/A"}\nDevice: ${wallet.deviceProfile?.os || "PC"} ${wallet.deviceProfile?.deviceType || "Desktop"} (${wallet.deviceProfile?.browser || "Browser"})\nStatus: Whitelisted Session Active (Persists across reloads)\nClick to disconnect`}
              onClick={onDisconnect}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <span style={{ color: "#00e699" }}>●</span>
              {wallet.coinPublicKey
                ? `${wallet.coinPublicKey.slice(0, 8)}...${wallet.coinPublicKey.slice(-6)}`
                : "Lace Connected"}
              <span
                style={{
                  fontSize: "10px",
                  background: "rgba(0, 230, 153, 0.15)",
                  color: "#00e699",
                  border: "1px solid rgba(0, 230, 153, 0.3)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
                title="Whitelisted device: session persists across reloads"
              >
                🔒 {wallet.isRestoredSession ? "Auto-Restored" : "Trusted Device"}
              </span>
            </button>
          </div>
        ) : isConnecting ? (
          <button
            id="connect-wallet-btn"
            className="btn-primary"
            disabled
            style={{ opacity: 0.75, cursor: "not-allowed" }}
          >
            <span>⏳</span> Authorizing in Lace...
          </button>
        ) : isDetecting ? (
          <button
            id="connect-wallet-btn"
            className="btn-secondary"
            disabled
            style={{ opacity: 0.7, cursor: "wait" }}
          >
            <span>🔍</span> Detecting Lace...
          </button>
        ) : wallet.status === "FAILED" || wallet.status === "REJECTED" || wallet.status === "TIMEOUT" ? (
          <button
            id="connect-wallet-btn"
            className="btn-primary"
            onClick={onConnect}
            title={wallet.error || "Retry connection"}
          >
            <span>🔄</span> Retry Connect
          </button>
        ) : (
          <button
            id="connect-wallet-btn"
            className="btn-primary"
            onClick={onConnect}
          >
            <span>🔌</span> Connect Lace Wallet
          </button>
        )}
      </div>
    </header>
  );
};
