import React, { useState } from "react";

export const SafetyBanner: React.FC = () => {
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
  };

  return (
    <div id="pactra-safety-banner" className="notice notice--warn" style={{ marginBottom: 32 }} role="note">
      <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div>
          <div className="notice-title">You are on the Midnight Preprod testnet</div>
          <div>
            DUST and tNIGHT here have no value and come free from the{" "}
            <a href="https://midnight-tmnight-preprod.nethermind.dev/" target="_blank" rel="noreferrer">
              Nethermind faucet
            </a>
            . Use a wallet made for testing. Pactra never asks for a seed phrase or private key, so never type one here.
          </div>
        </div>
        <button className="close-x" onClick={handleDismiss} aria-label="Dismiss for this session" />
      </div>
    </div>
  );
};
