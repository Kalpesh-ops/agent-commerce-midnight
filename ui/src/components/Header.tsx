import React from "react";
import { WalletState } from "../services/wallet";
import { MidnightNetworkId } from "../types/midnight";
import { Brandmark, Tag, shortHash } from "./ui";

interface HeaderProps {
  wallet: WalletState;
  isLiveMode: boolean;
  contractAddress?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onNetworkChange: (net: MidnightNetworkId) => void;
  activityCount: number;
  onToggleActivity: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  wallet,
  isLiveMode,
  contractAddress,
  onConnect,
  onDisconnect,
  onNetworkChange,
  activityCount,
  onToggleActivity,
}) => {
  const isConnecting = wallet.status === "CONNECTING";
  const isDetecting = wallet.status === "DETECTING";
  const hasFailed = wallet.status === "FAILED" || wallet.status === "REJECTED" || wallet.status === "TIMEOUT";

  const modeTag = isLiveMode ? (
    <Tag tone="ok" id="badge-live-preprod" title="Signed transactions go to Midnight Preprod">
      Live
    </Tag>
  ) : wallet.isConnected && wallet.networkId === "preprod" && !contractAddress ? (
    <Tag tone="seal" id="badge-preprod-ready" title="Wallet is ready. Deploy or attach a contract on the Escrow page.">
      No contract yet
    </Tag>
  ) : (
    <Tag tone="warn" id="badge-demo-mode" title="Actions run against a local simulation. Nothing is sent on-chain.">
      Simulation
    </Tag>
  );

  return (
    <header className="topbar">
      <a className="brand" href="#/start" aria-label="Pactra home">
        <Brandmark size={26} />
        <span className="brand-word">pactra</span>
        <span className="brand-net">Preprod</span>
      </a>

      <span className="topbar-spacer" />

      <div className="topbar-group">
        <span className="hide-sm">{modeTag}</span>

        <label className="hide-sm">
          <span className="sr-only">Target network</span>
          <select
            className="select"
            style={{ minHeight: 36, width: "auto", fontSize: 13 }}
            value={wallet.networkId}
            disabled={isConnecting || isDetecting}
            onChange={(e) => onNetworkChange(e.target.value as MidnightNetworkId)}
          >
            <option value="preprod">Preprod testnet</option>
            <option value="preview">Preview testnet</option>
            <option value="undeployed">Local (undeployed)</option>
          </select>
        </label>

        <button className="btn btn--sm btn--quiet hide-sm" onClick={onToggleActivity} aria-label={`Activity log, ${activityCount} entries`}>
          Activity <span className="faint">{activityCount}</span>
        </button>

        {wallet.isConnected ? (
          <button
            id="wallet-connected-btn"
            className="btn btn--sm"
            onClick={onDisconnect}
            title={`Shielded coin key: ${wallet.coinPublicKey || "n/a"}\n${
              wallet.isRestoredSession ? "Session restored on this trusted device." : "Trusted device session."
            }\nClick to disconnect.`}
          >
            <span className="mark mark--fill c-ok" aria-hidden="true" />
            <span className="hash">{wallet.coinPublicKey ? shortHash(wallet.coinPublicKey, 6, 4) : "Lace connected"}</span>
          </button>
        ) : isConnecting ? (
          <button id="connect-wallet-btn" className="btn btn--sm btn--primary" disabled>
            Approve in Lace...
          </button>
        ) : isDetecting ? (
          <button id="connect-wallet-btn" className="btn btn--sm" disabled>
            Looking for Lace...
          </button>
        ) : (
          <button
            id="connect-wallet-btn"
            className="btn btn--sm btn--primary"
            onClick={onConnect}
            title={hasFailed ? wallet.error || "Retry connection" : "Connect the Midnight Lace wallet"}
          >
            {hasFailed ? "Retry wallet" : "Connect wallet"}
          </button>
        )}
      </div>
    </header>
  );
};
