import React, { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { EscrowTimeline } from "./components/EscrowTimeline";
import { TaskDetailsCard } from "./components/TaskDetailsCard";
import { RoleActionPanel } from "./components/RoleActionPanel";
import { AgentAuthorityPanel } from "./components/AgentAuthorityPanel";
import { MarketplaceView } from "./components/MarketplaceView";
import { ArbitrationPanel } from "./components/ArbitrationPanel";
import { PrivacyModelInspector } from "./components/PrivacyModelInspector";
import { OnboardingModal } from "./components/OnboardingModal";
import { ComputeGuidedDemo } from "./components/ComputeGuidedDemo";
import { SafetyBanner } from "./components/SafetyBanner";
import { FeedbackModal } from "./components/FeedbackModal";
import { ProductMetricsView } from "./components/ProductMetricsView";
import { FeedbackDashboard } from "./components/FeedbackDashboard";
import { NetworkBadge } from "./components/NetworkBadge";
import { SystemHealthPanel } from "./components/SystemHealthPanel";
import { getEnvironmentConfig, UiEnvironmentConfig } from "./config/network";
import { walletService, WalletState } from "./services/wallet";
import { escrowService, EscrowContractData } from "./services/escrowService";
import { contractClient, TxLifecycleEvent } from "./services/contractClient";
import { MidnightNetworkId } from "./types/midnight";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "protocol" | "compute" | "marketplace" | "arbitration" | "privacy" | "metrics" | "feedback_dev" | "health"
  >("protocol");
  const [currentEnv, setCurrentEnv] = useState<UiEnvironmentConfig>(getEnvironmentConfig("PREPROD"));
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletState>(walletService.getState());
  const [escrowState, setEscrowState] = useState<EscrowContractData>(escrowService.getState());
  const [txLifecycle, setTxLifecycle] = useState<TxLifecycleEvent | null>(null);
  const [isIndexerLive, setIsIndexerLive] = useState<boolean>(false);

  const [logs, setLogs] = useState<Array<{ text: string; type: "info" | "success" | "error" }>>([
    { text: "Pactra Agent Commerce & Escrow Protocol initialized.", type: "info" },
    { text: "Target Network: Midnight Preprod Testnet.", type: "info" },
  ]);

  const addLog = useCallback((text: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [
      { text: `[${new Date().toLocaleTimeString()}] ${text}`, type },
      ...prev.slice(0, 30),
    ]);
  }, []);

  // 1. Subscribe to deterministic Wallet Service state machine
  useEffect(() => {
    const unsubscribe = walletService.subscribe((updatedState) => {
      setWallet(updatedState);
      if (updatedState.status === "WALLET_DETECTED") {
        addLog(`Midnight Lace connector detected (${updatedState.detectedWalletName || "Lace"}). Ready to connect.`, "info");
      } else if (updatedState.status === "CONNECTED") {
        addLog(`Lace wallet verified and connected on ${updatedState.activeNetwork || updatedState.networkId}.`, "success");
      } else if (updatedState.status === "REJECTED") {
        addLog("Wallet connection rejected by user in Lace popup.", "error");
      } else if (updatedState.status === "TIMEOUT") {
        addLog("Wallet authorization request timed out.", "error");
      } else if (updatedState.status === "FAILED" && updatedState.error) {
        addLog(`Wallet connection error: ${updatedState.error}`, "error");
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addLog]);

  // 2. Transaction lifecycle listener
  useEffect(() => {
    contractClient.setLifecycleListener((event) => {
      setTxLifecycle(event);
      if (event.status === "PENDING_USER_SIGNATURE") {
        addLog(event.message, "info");
      } else if (event.status === "SUBMITTED") {
        addLog(event.message, "info");
      } else if (event.status === "CONFIRMING") {
        addLog(event.message, "info");
      } else if (event.status === "CONFIRMED") {
        addLog(`Transaction confirmed on-chain! Tx: ${event.txHash}`, "success");
      } else if (event.status === "FAILED") {
        addLog(`Transaction failed: ${event.error || event.message}`, "error");
      }
    });
  }, [addLog]);

  // 3. Preprod Indexer Health Verification with Visibility-Aware Debouncing
  useEffect(() => {
    let isMounted = true;
    const verifyIndexer = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return; // Suspend background HTTP requests when tab is inactive
      }
      try {
        const res = await fetch("https://indexer.preprod.midnight.network/api/v4/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ currentEpochInfo { epochNo } }" }),
        });
        const json = await res.json();
        if (json?.data?.currentEpochInfo?.epochNo && isMounted) {
          setIsIndexerLive(true);
        }
      } catch {
        if (isMounted) setIsIndexerLive(false);
      }
    };

    verifyIndexer();
    const interval = setInterval(verifyIndexer, 25000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        verifyIndexer();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // 4. Reconstruct state from persisted contract address on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem("midnight_task_escrow_contract_address");
    if (savedAddress) {
      addLog(`Found persisted contract address: ${savedAddress.slice(0, 16)}...`, "info");
      escrowService
        .syncWithIndexer(savedAddress)
        .then((reconstructed) => {
          if (reconstructed) {
            setEscrowState(reconstructed);
            addLog(
              `Reconstructed TaskEscrow state from Midnight Preprod Indexer: State=${reconstructed.taskState}, Escrowed=${reconstructed.escrowedAmount} DUST.`,
              "success"
            );
          } else {
            addLog(
              `Contract ${savedAddress.slice(0, 16)}... not yet indexed or pending block confirmation.`,
              "info"
            );
          }
        })
        .catch((err) => {
          addLog(`Indexer query error: ${err.message}`, "error");
        });
    }
  }, [addLog]);

  const handleConnectWallet = async () => {
    if (wallet.status === "CONNECTING") {
      return;
    }
    addLog(`Initiating handshake with Midnight Lace on ${wallet.networkId}...`, "info");
    const res = await walletService.connect(wallet.networkId);
    if (res.status === "CONNECTED") {
      addLog(
        `Wallet connected successfully! Shielded Coin PK: ${res.coinPublicKey?.slice(0, 16)}...`,
        "success"
      );
      const currentAddr = contractClient.getActiveContractAddress() || escrowState.contractAddress;
      if (currentAddr) {
        escrowService.setMode("live");
        handleRefreshIndexer();
      }
    }
  };

  const handleDisconnectWallet = () => {
    walletService.disconnect();
    addLog("Lace wallet disconnected.", "info");
  };

  const handleNetworkChange = (net: MidnightNetworkId) => {
    setWallet((prev) => ({ ...prev, networkId: net }));
    addLog(`Switched network target to ${net}.`, "info");
    if (wallet.isConnected) {
      walletService.disconnect();
      addLog("Disconnected wallet due to target network change. Please reconnect on the new network.", "info");
    }
  };

  const handleDeployContract = async () => {
    try {
      addLog("Preparing TaskEscrow deployment on Midnight Preprod via Lace wallet...", "info");
      addLog("Manual Action Required: Open your Midnight Lace extension window and approve the deployment transaction fee.", "info");
      const deployedAddress = await escrowService.deployOnPreprod((event) => {
        setTxLifecycle(event);
      });
      const newState = escrowService.getState();
      setEscrowState(newState);
      addLog(
        `Contract deployed on Preprod! Address: ${deployedAddress}`,
        "success"
      );
    } catch (err: any) {
      addLog(`Deployment failed: ${err.message}`, "error");
    }
  };

  const handleJoinContract = async (address: string) => {
    try {
      addLog(`Joining deployed TaskEscrow contract: ${address}...`, "info");
      const joinedState = await escrowService.joinDeployed(address);
      if (joinedState) {
        setEscrowState(joinedState);
        addLog(`Joined contract and synchronized state from indexer.`, "success");
      } else {
        addLog(`Joined contract, but indexer returned no ledger state yet.`, "info");
      }
    } catch (err: any) {
      addLog(`Join contract error: ${err.message}`, "error");
    }
  };

  const handleRefreshIndexer = async () => {
    const currentAddr = contractClient.getActiveContractAddress() || escrowState.contractAddress;
    if (!currentAddr) {
      addLog("No contract address available to query indexer.", "info");
      return;
    }
    try {
      addLog(`Querying Midnight Preprod GraphQL indexer for ${currentAddr.slice(0, 16)}...`, "info");
      const updated = await escrowService.syncWithIndexer(currentAddr);
      if (updated) {
        setEscrowState(updated);
        addLog(
          `Indexer sync complete: State=${updated.taskState}, Escrowed=${updated.escrowedAmount} DUST.`,
          "success"
        );
      } else {
        addLog("No ledger state returned by indexer for this contract.", "info");
      }
    } catch (err: any) {
      addLog(`Indexer sync failed: ${err.message}`, "error");
    }
  };

  const handleCreateTask = async (budget: number) => {
    try {
      addLog(`Executing createTask circuit (Budget: ${budget} DUST)...`, "info");
      const newState = await escrowService.createTask(
        {
          taskId: `0xtask_${Date.now().toString(16).padStart(16, "0")}`,
          agentCommitment: "0xagent_pk_88a3f5912e7bc401000000000000000000000000000000000000000000000000",
          maxBudget: budget,
          conditionHash: "0xcond_sha256_dataset_clean_verified_spec_00000000000000000000000000000000",
          creatorSecret: "creator_entropy_seed_secret",
        },
        (event) => setTxLifecycle(event)
      );
      setEscrowState(newState);
      addLog(`Task created! Task ID: ${newState.taskId}`, "success");
    } catch (err: any) {
      addLog(`createTask error: ${err.message}`, "error");
    }
  };

  const handleFundTask = async (amount: number) => {
    try {
      addLog(`Executing fundTask circuit deposit: ${amount} DUST/tNIGHT...`, "info");
      const newState = await escrowService.fundTask(amount, (event) => setTxLifecycle(event));
      setEscrowState(newState);
      addLog(`Task funded! New escrow balance: ${newState.escrowedAmount} DUST.`, "success");
    } catch (err: any) {
      addLog(`fundTask error: ${err.message}`, "error");
    }
  };

  const handleAcceptTask = async () => {
    try {
      addLog("Agent proving identity commitment with local witness via acceptTask circuit...", "info");
      const newState = await escrowService.acceptTask((event) => setTxLifecycle(event));
      setEscrowState(newState);
      addLog("Task accepted! State changed to ACTIVE.", "success");
    } catch (err: any) {
      addLog(`acceptTask error: ${err.message}`, "error");
    }
  };

  const handleSubmitCompletion = async (evidenceHash: string) => {
    try {
      addLog(`Agent submitting completion evidence hash via submitCompletion circuit: ${evidenceHash.slice(0, 20)}...`, "info");
      const newState = await escrowService.submitCompletion(evidenceHash, (event) => setTxLifecycle(event));
      setEscrowState(newState);
      addLog("Evidence submitted! State changed to COMPLETION_PENDING.", "success");
    } catch (err: any) {
      addLog(`submitCompletion error: ${err.message}`, "error");
    }
  };

  const handleSettleTask = async (payoutAmount: number) => {
    try {
      addLog(`Executing settleTask circuit: releasing ${payoutAmount} DUST payout to agent...`, "info");
      const newState = await escrowService.settleTask(payoutAmount, (event) => setTxLifecycle(event));
      setEscrowState(newState);
      addLog("Task settled! Payout released to agent. State changed to COMPLETED.", "success");
    } catch (err: any) {
      addLog(`settleTask error: ${err.message}`, "error");
    }
  };

  const handleRefundTask = async () => {
    try {
      addLog("Executing refundTask circuit: reclaiming escrowed funds...", "info");
      const newState = await escrowService.refundTask((event) => setTxLifecycle(event));
      setEscrowState(newState);
      addLog("Task refunded! Escrowed funds returned to creator.", "success");
    } catch (err: any) {
      addLog(`refundTask error: ${err.message}`, "error");
    }
  };

  const handleResetDemo = () => {
    const newState = escrowService.resetDemo();
    setEscrowState(newState);
    setTxLifecycle(null);
    addLog("Demo state reset to UNINITIALIZED.", "info");
  };

  // Strict LIVE Mode Invariant: requires authenticated Lace + Preprod network + real contract + live indexer
  const isLive =
    wallet.status === "CONNECTED" &&
    wallet.networkId === "preprod" &&
    Boolean(escrowState.contractAddress) &&
    escrowService.getMode() === "live" &&
    isIndexerLive;

  return (
    <div className="app-container">
      <Header
        wallet={wallet}
        isLiveMode={isLive}
        contractAddress={escrowState.contractAddress}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
        onNetworkChange={handleNetworkChange}
        onOpenGuide={() => setIsOnboardingOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onModeToggle={(mode) => {
          escrowService.setMode(mode);
          setEscrowState(escrowService.getState());
          addLog(`Switched operating mode to ${mode.toUpperCase()}.`, "info");
        }}
        onContractAddressChange={(addr) => {
          handleJoinContract(addr);
        }}
      />

      <SafetyBanner />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        onLog={addLog}
      />

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => {
          setIsOnboardingOpen(false);
          try {
            localStorage.setItem("pactra_onboarding_shown", "true");
          } catch {
            // ignore localStorage errors
          }
        }}
        onStartGuide={() => {
          setIsOnboardingOpen(false);
          setActiveTab("compute");
          try {
            localStorage.setItem("pactra_onboarding_shown", "true");
          } catch {
            // ignore localStorage errors
          }
        }}
      />

      {/* Wallet Error Diagnostic Banner */}
      {wallet.error && wallet.status !== "CONNECTED" && (
        <div
          id="wallet-diagnostic-banner"
          style={{
            marginTop: "16px",
            padding: "12px 16px",
            background: "rgba(255, 51, 102, 0.12)",
            border: "1px solid var(--crimson)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "var(--crimson)" }}>
                Wallet Connection Notice ({wallet.errorCode || wallet.status})
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-main)", marginTop: "2px" }}>
                {wallet.error}
              </div>
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: "6px 14px", fontSize: "12px", whiteSpace: "nowrap" }}
            onClick={handleConnectWallet}
          >
            🔄 Retry Connect
          </button>
        </div>
      )}

      <section className="vision-banner">
        <h2>Pactra: Autonomous Agent Commerce & Escrow Protocol</h2>
        <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--cyan)", margin: "6px 0 10px 0" }}>
          "Give an agent a goal and bounded economic authority — not your wallet."
        </p>
        <p>
          A privacy-preserving economic operating system for autonomous AI agents on Midnight.
          AI agents privately plan, procure, and settle resources under cryptographically anchored policies without unrestricted treasury custody.
        </p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
          <div className="security-badge" style={{ margin: 0 }}>
            <span>🔒</span> Core Security Invariant: The agent NEVER receives unrestricted access to the user treasury.
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              background: isIndexerLive ? "rgba(0, 230, 153, 0.1)" : "rgba(255, 170, 0, 0.1)",
              border: `1px solid ${isIndexerLive ? "rgba(0, 230, 153, 0.3)" : "rgba(255, 170, 0, 0.3)"}`,
              borderRadius: "var(--radius-full)",
              fontSize: "11px",
              fontWeight: 700,
              color: isIndexerLive ? "var(--emerald)" : "var(--amber)",
            }}
            title={isIndexerLive ? "Midnight Preprod Indexer is reachable and reporting epochs" : "Indexer connectivity pending or slow"}
          >
            <span style={{ fontSize: "10px" }}>{isIndexerLive ? "●" : "○"}</span>
            <span>Preprod Indexer: {isIndexerLive ? "Online (Epoch Active)" : "Querying Indexer..."}</span>
          </div>
          <NetworkBadge
            currentEnv={currentEnv}
            detectedWalletNetwork={wallet.activeNetwork || wallet.networkId}
            onSwitchEnv={(envId) => {
              setCurrentEnv(getEnvironmentConfig(envId));
              addLog(`Switched network target to ${envId}`, "info");
            }}
          />
        </div>
      </section>

      {/* Production Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          borderBottom: "1px solid var(--border-glow)",
          paddingBottom: "12px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`tab-btn ${activeTab === "protocol" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("protocol")}
        >
          🏛️ Task & Protocol
        </button>
        <button
          className={`tab-btn ${activeTab === "compute" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("compute")}
        >
          ⚡ Guided Compute MVP
        </button>
        <button
          className={`tab-btn ${activeTab === "marketplace" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("marketplace")}
        >
          🏪 Multi-Service Marketplace
        </button>
        <button
          className={`tab-btn ${activeTab === "arbitration" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("arbitration")}
        >
          ⚖️ Threshold Arbitration
        </button>
        <button
          className={`tab-btn ${activeTab === "privacy" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("privacy")}
        >
          🛡️ Privacy & State Boundaries
        </button>
        <button
          className={`tab-btn ${activeTab === "health" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("health")}
        >
          🩺 System Health & Network
        </button>
        <button
          className={`tab-btn ${activeTab === "metrics" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("metrics")}
        >
          📊 Truthful Metrics
        </button>
        <button
          className={`tab-btn ${activeTab === "feedback_dev" ? "active" : ""}`}
          style={{ padding: "8px 18px", fontSize: "13px", fontWeight: 700 }}
          onClick={() => setActiveTab("feedback_dev")}
        >
          🛠️ Tester Feedback Log
        </button>
      </div>

      {activeTab === "protocol" && (
        <>
          <EscrowTimeline
            taskState={escrowState.taskState}
            settlementState={escrowState.settlementState}
          />

          <div className="dashboard-grid">
            <TaskDetailsCard
              data={escrowState}
              onRefreshFromIndexer={escrowState.contractAddress ? handleRefreshIndexer : undefined}
            />
            <RoleActionPanel
              data={escrowState}
              isLiveMode={isLive}
              txLifecycle={txLifecycle}
              onDeployContract={handleDeployContract}
              onJoinContract={handleJoinContract}
              onCreateTask={handleCreateTask}
              onFundTask={handleFundTask}
              onAcceptTask={handleAcceptTask}
              onSubmitCompletion={handleSubmitCompletion}
              onSettleTask={handleSettleTask}
              onRefundTask={handleRefundTask}
              onResetDemo={handleResetDemo}
            />
          </div>

          <AgentAuthorityPanel
            onLog={addLog}
            onMidnightSettle={escrowState.taskState === "COMPLETION_PENDING" ? () => handleSettleTask(2) : undefined}
            isMidnightBusy={Boolean(txLifecycle && ["PENDING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(txLifecycle.status))}
          />
        </>
      )}

      {activeTab === "compute" && (
        <ComputeGuidedDemo
          onLog={addLog}
          onNavigateToEscrow={() => setActiveTab("protocol")}
        />
      )}

      {activeTab === "marketplace" && (
        <MarketplaceView
          onLog={addLog}
          onServiceProcured={() => {
            setActiveTab("protocol");
          }}
        />
      )}

      {activeTab === "arbitration" && (
        <ArbitrationPanel onLog={addLog} />
      )}

      {activeTab === "privacy" && (
        <PrivacyModelInspector />
      )}

      {activeTab === "health" && (
        <SystemHealthPanel
          currentEnv={currentEnv}
          isWalletConnected={wallet.status === "CONNECTED"}
          walletNetwork={wallet.activeNetwork || wallet.networkId}
          activeContractAddress={escrowState.contractAddress}
        />
      )}

      {activeTab === "metrics" && (
        <ProductMetricsView
          escrowState={escrowState}
          isIndexerLive={isIndexerLive}
        />
      )}

      {activeTab === "feedback_dev" && (
        <FeedbackDashboard onLog={addLog} />
      )}

      <div className="tx-log">
        <div style={{ color: "var(--text-muted)", marginBottom: "4px", fontSize: "11px", fontWeight: 700 }}>
          PROTOCOL ACTIVITY & ZERO-KNOWLEDGE PROOF LOG
        </div>
        {logs.map((log, idx) => (
          <div key={idx} className={`tx-log-item ${log.type}`}>
            {log.text}
          </div>
        ))}
      </div>
    </div>
  );
};
