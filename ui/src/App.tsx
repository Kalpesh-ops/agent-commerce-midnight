import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { EscrowTimeline } from "./components/EscrowTimeline";
import { TaskDetailsCard } from "./components/TaskDetailsCard";
import { RoleActionPanel } from "./components/RoleActionPanel";
import { AgentAuthorityPanel } from "./components/AgentAuthorityPanel";
import { MarketplaceView } from "./components/MarketplaceView";
import { ArbitrationPanel } from "./components/ArbitrationPanel";
import { PrivacyModelInspector } from "./components/PrivacyModelInspector";
import { ComputeGuidedDemo } from "./components/ComputeGuidedDemo";
import { SafetyBanner } from "./components/SafetyBanner";
import { FeedbackModal } from "./components/FeedbackModal";
import { ProductMetricsView } from "./components/ProductMetricsView";
import { FeedbackDashboard } from "./components/FeedbackDashboard";
import { NetworkBadge } from "./components/NetworkBadge";
import { SystemHealthPanel } from "./components/SystemHealthPanel";
import { StartPage } from "./components/StartPage";
import { ActivityDrawer, ActivityEntry } from "./components/ActivityDrawer";
import { LegalPage } from "./components/LegalPage";
import { PageHead, Tag } from "./components/ui";
import { getEnvironmentConfig, UiEnvironmentConfig } from "./config/network";
import { walletService, WalletState } from "./services/wallet";
import { escrowService, EscrowContractData } from "./services/escrowService";
import { contractClient, TxLifecycleEvent } from "./services/contractClient";
import { MidnightNetworkId } from "./types/midnight";

export type RouteId =
  | "start"
  | "walkthrough"
  | "escrow"
  | "agent"
  | "services"
  | "disputes"
  | "privacy"
  | "system"
  | "terms"
  | "privacy-policy";

export const NAV: { group: string; items: { id: RouteId; num: string; label: string }[] }[] = [
  {
    group: "Begin",
    items: [
      { id: "start", num: "01", label: "Start here" },
      { id: "walkthrough", num: "02", label: "Walkthrough" },
    ],
  },
  {
    group: "Operate",
    items: [
      { id: "escrow", num: "03", label: "Escrow" },
      { id: "agent", num: "04", label: "Agent authority" },
      { id: "services", num: "05", label: "Services" },
      { id: "disputes", num: "06", label: "Disputes" },
    ],
  },
  {
    group: "Inspect",
    items: [
      { id: "privacy", num: "07", label: "Privacy model" },
      { id: "system", num: "08", label: "System" },
    ],
  },
];

const ROUTE_IDS = new Set<string>([...NAV.flatMap((g) => g.items.map((i) => i.id)), "terms", "privacy-policy"]);

const readRoute = (): RouteId => {
  const id = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return (ROUTE_IDS.has(id) ? id : "start") as RouteId;
};

export const App: React.FC = () => {
  const [route, setRoute] = useState<RouteId>(readRoute);
  const [systemTab, setSystemTab] = useState<"health" | "metrics" | "feedback">("health");
  const [currentEnv, setCurrentEnv] = useState<UiEnvironmentConfig>(getEnvironmentConfig("PREPROD"));
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [wallet, setWallet] = useState<WalletState>(walletService.getState());
  const [escrowState, setEscrowState] = useState<EscrowContractData>(escrowService.getState());
  const [txLifecycle, setTxLifecycle] = useState<TxLifecycleEvent | null>(null);
  const [isIndexerLive, setIsIndexerLive] = useState<boolean>(false);
  const [isIndexerChecked, setIsIndexerChecked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [connectAttempted, setConnectAttempted] = useState<boolean>(false);
  const connectInFlight = useRef(false);

  const [logs, setLogs] = useState<ActivityEntry[]>(() => [
    { time: new Date().toLocaleTimeString(), text: "Pactra console ready. Target network: Midnight Preprod.", type: "info" },
  ]);

  const addLog = useCallback((text: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString(), text, type }, ...prev.slice(0, 49)]);
  }, []);

  const navigate = useCallback((id: RouteId) => {
    window.location.hash = `/${id}`;
  }, []);

  // 0. Hash router
  useEffect(() => {
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };

    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Keep the active section visible in the horizontal nav on small screens
  useEffect(() => {
    document.querySelector('.nav-link[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [route]);

  // 1. Subscribe to deterministic Wallet Service state machine
  useEffect(() => {
    const unsubscribe = walletService.subscribe((updatedState) => {
      setWallet(updatedState);
      if (updatedState.status === "WALLET_DETECTED") {
        addLog(`${updatedState.detectedWalletName || "Lace"} wallet detected. Ready to connect.`, "info");
      } else if (updatedState.status === "CONNECTED") {
        addLog(`Lace connected on ${updatedState.activeNetwork || updatedState.networkId}.`, "success");
      } else if (updatedState.status === "REJECTED") {
        addLog("Connection request was declined in Lace.", "error");
      } else if (updatedState.status === "TIMEOUT") {
        addLog("Lace did not answer in time.", "error");
      } else if (updatedState.status === "FAILED" && updatedState.error) {
        addLog(`Wallet error: ${updatedState.error}`, "error");
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
      if (event.status === "CONFIRMED") {
        addLog(`Transaction confirmed. Tx ${event.txHash}`, "success");
      } else if (event.status === "FAILED") {
        addLog(`Transaction failed: ${event.error || event.message}`, "error");
      } else if (["PENDING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(event.status)) {
        addLog(event.message, "info");
      }
    });
  }, [addLog]);

  // 3. Preprod indexer health, paused while the tab is hidden
  useEffect(() => {
    let isMounted = true;
    const verifyIndexer = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      try {
        const res = await fetch("https://indexer.preprod.midnight.network/api/v4/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ currentEpochInfo { epochNo } }" }),
        });
        const json = await res.json();
        if (isMounted) setIsIndexerLive(Boolean(json?.data?.currentEpochInfo?.epochNo));
      } catch {
        if (isMounted) setIsIndexerLive(false);
      } finally {
        if (isMounted) setIsIndexerChecked(true);
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
      addLog(`Found saved contract ${savedAddress.slice(0, 16)}...`, "info");
      setIsSyncing(true);
      escrowService
        .syncWithIndexer(savedAddress)
        .then((reconstructed) => {
          if (reconstructed) {
            setEscrowState(reconstructed);
            addLog(
              `Restored escrow from the Preprod indexer: ${reconstructed.taskState}, ${reconstructed.escrowedAmount} DUST held.`,
              "success"
            );
          } else {
            addLog(`Contract ${savedAddress.slice(0, 16)}... is not indexed yet.`, "info");
          }
        })
        .catch((err) => {
          addLog(`Indexer query error: ${err.message}`, "error");
        })
        .finally(() => setIsSyncing(false));
    } else {
      // No contract yet: run the escrow against the local simulation until one is deployed or attached.
      escrowService.setMode("demo");
      setEscrowState(escrowService.getState());
    }
  }, [addLog]);

  const handleConnectWallet = async () => {
    // Header, Start page and the error banner all call this; only the first click in flight counts.
    if (connectInFlight.current) {
      return;
    }
    connectInFlight.current = true;
    try {
      await connectWallet();
    } finally {
      connectInFlight.current = false;
    }
  };

  const connectWallet = async () => {
    setConnectAttempted(true);
    addLog(`Asking Lace to connect on ${wallet.networkId}...`, "info");
    const res = await walletService.connect(wallet.networkId);
    if (res.status === "CONNECTED") {
      addLog(`Wallet connected. Shielded coin key ${res.coinPublicKey?.slice(0, 16)}...`, "success");
      const currentAddr = contractClient.getActiveContractAddress() || escrowState.contractAddress;
      if (currentAddr) {
        escrowService.setMode("live");
        handleRefreshIndexer();
      }
    }
  };

  const handleDisconnectWallet = () => {
    if (!window.confirm("Disconnect Lace from Pactra? You will need to approve the connection again next time.")) return;
    walletService.disconnect();
    addLog("Lace wallet disconnected.", "info");
  };

  const handleNetworkChange = (net: MidnightNetworkId) => {
    if (connectInFlight.current || net === wallet.networkId) return;
    if (wallet.isConnected && !window.confirm(`Switching to ${net} disconnects Lace. Continue?`)) return;
    setWallet((prev) => ({ ...prev, networkId: net }));
    addLog(`Target network set to ${net}.`, "info");
    if (wallet.isConnected) {
      walletService.disconnect();
      addLog("Wallet disconnected because the target network changed. Reconnect on the new network.", "info");
    }
  };

  const handleDeployContract = async () => {
    try {
      if (!wallet.isConnected) {
        addLog("Connecting Lace before deployment...", "info");
        const connRes = await walletService.connect(wallet.networkId);
        if (connRes.status !== "CONNECTED") {
          throw new Error("Connect your Lace wallet to deploy on-chain.");
        }
      }
      addLog("Preparing TaskEscrow deployment on Preprod. Approve the fee in Lace.", "info");
      const deployedAddress = await escrowService.deployOnPreprod((event) => {
        setTxLifecycle(event);
      });
      setEscrowState(escrowService.getState());
      addLog(`Contract deployed at ${deployedAddress}`, "success");
    } catch (err: any) {
      addLog(`Deployment failed: ${err.message}`, "error");
      throw err;
    }
  };

  const handleJoinContract = async (address: string) => {
    try {
      addLog(`Attaching to contract ${address}...`, "info");
      setIsSyncing(true);
      const joinedState = await escrowService.joinDeployed(address);
      if (joinedState) {
        setEscrowState(joinedState);
        addLog("Attached and synced from the indexer.", "success");
      } else {
        addLog("Attached. The indexer has no ledger state for it yet.", "info");
      }
    } catch (err: any) {
      addLog(`Attach failed: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshIndexer = async () => {
    const currentAddr = contractClient.getActiveContractAddress() || escrowState.contractAddress;
    if (!currentAddr) {
      addLog("No contract address to query.", "info");
      return;
    }
    setIsSyncing(true);
    try {
      addLog(`Querying the Preprod indexer for ${currentAddr.slice(0, 16)}...`, "info");
      const updated = await escrowService.syncWithIndexer(currentAddr);
      if (updated) {
        setEscrowState(updated);
        addLog(`Synced: ${updated.taskState}, ${updated.escrowedAmount} DUST held.`, "success");
      } else {
        addLog("The indexer returned no ledger state for this contract.", "info");
      }
    } catch (err: any) {
      addLog(`Indexer sync failed: ${err.message}`, "error");
    } finally {
      setIsSyncing(false);
    }
  };

  const runCircuit = async (
    label: string,
    exec: () => Promise<EscrowContractData>,
    success: (s: EscrowContractData) => string
  ) => {
    try {
      addLog(`Running ${label}...`, "info");
      const newState = await exec();
      setEscrowState(newState);
      addLog(success(newState), "success");
    } catch (err: any) {
      addLog(`${label} failed: ${err.message}`, "error");
      throw err;
    }
  };

  const onTx = (event: TxLifecycleEvent) => setTxLifecycle(event);

  const handleCreateTask = (budget: number) =>
    runCircuit(
      `createTask with a ${budget} DUST ceiling`,
      () =>
        escrowService.createTask(
          {
            taskId: `0xtask_${Date.now().toString(16).padStart(16, "0")}`,
            agentCommitment: "0xagent_pk_88a3f5912e7bc401000000000000000000000000000000000000000000000000",
            maxBudget: budget,
            conditionHash: "0xcond_sha256_dataset_clean_verified_spec_00000000000000000000000000000000",
            creatorSecret: "creator_entropy_seed_secret",
          },
          onTx
        ),
      (s) => `Task created: ${s.taskId}`
    );

  const handleFundTask = (amount: number) =>
    runCircuit(`fundTask for ${amount} DUST`, () => escrowService.fundTask(amount, onTx), (s) => `Escrow funded. Balance ${s.escrowedAmount} DUST.`);

  const handleAcceptTask = () =>
    runCircuit("acceptTask (agent proves its commitment)", () => escrowService.acceptTask(onTx), () => "Agent accepted. Task is active.");

  const handleSubmitCompletion = (evidenceHash: string) =>
    runCircuit(
      "submitCompletion",
      () => escrowService.submitCompletion(evidenceHash, onTx),
      () => "Evidence submitted. Waiting for the creator to settle."
    );

  const handleSettleTask = (payoutAmount: number) =>
    runCircuit(
      `settleTask paying ${payoutAmount} DUST`,
      () => escrowService.settleTask(payoutAmount, onTx),
      () => "Settled. Payout released to the agent."
    );

  const handleRefundTask = () =>
    runCircuit("refundTask", () => escrowService.refundTask(onTx), () => "Refunded. Escrowed funds returned to the creator.");

  const handleResetDemo = () => {
    setEscrowState(escrowService.resetDemo());
    setTxLifecycle(null);
    addLog("Simulation reset.", "info");
  };

  // LIVE requires authenticated Lace + Preprod network + real contract + live indexer
  const isLive =
    wallet.status === "CONNECTED" &&
    wallet.networkId === "preprod" &&
    Boolean(escrowState.contractAddress) &&
    escrowService.getMode() === "live" &&
    isIndexerLive;

  const isTxBusy = Boolean(txLifecycle && ["PENDING_USER_SIGNATURE", "SUBMITTED", "CONFIRMING"].includes(txLifecycle.status));

  const renderPage = () => {
    switch (route) {
      case "start":
        return (
          <StartPage
            wallet={wallet}
            escrowState={escrowState}
            isLive={isLive}
            isIndexerLive={isIndexerLive}
            isIndexerChecked={isIndexerChecked}
            onConnect={handleConnectWallet}
          />
        );
      case "walkthrough":
        return <ComputeGuidedDemo onLog={addLog} onNavigateToEscrow={() => navigate("escrow")} />;
      case "escrow":
        return (
          <div className="page">
            <PageHead
              num="03"
              section="Escrow"
              title="One task, one escrow, six circuits."
              lede="Create a task with a spending ceiling, fund it, let the agent accept and deliver, then settle or refund. Switch between the creator and agent roles on the right."
              aside={
                isLive ? (
                  <Tag tone="ok">Live on Preprod</Tag>
                ) : escrowState.contractAddress ? (
                  <Tag tone="warn">Contract attached, not live</Tag>
                ) : (
                  <Tag tone="warn">Simulation</Tag>
                )
              }
            />
            <EscrowTimeline taskState={escrowState.taskState} settlementState={escrowState.settlementState} />
            <div className="cols-split" style={{ marginTop: 24 }}>
              <TaskDetailsCard
                data={escrowState}
                isSyncing={isSyncing}
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
          </div>
        );
      case "agent":
        return (
          <AgentAuthorityPanel
            onLog={addLog}
            onMidnightSettle={escrowState.taskState === "COMPLETION_PENDING" ? () => handleSettleTask(2) : undefined}
            isMidnightBusy={isTxBusy}
          />
        );
      case "services":
        return <MarketplaceView onLog={addLog} />;
      case "disputes":
        return <ArbitrationPanel onLog={addLog} />;
      case "privacy":
        return <PrivacyModelInspector />;
      case "system":
        return (
          <div className="page">
            <PageHead
              num="08"
              section="System"
              title="What is running, and what is simulated."
              lede="Network health, honest usage counts, and the tester feedback log."
              aside={
                <NetworkBadge
                  currentEnv={currentEnv}
                  detectedWalletNetwork={wallet.activeNetwork || wallet.networkId}
                  onSwitchEnv={(envId) => {
                    setCurrentEnv(getEnvironmentConfig(envId));
                    addLog(`Environment set to ${envId}.`, "info");
                  }}
                />
              }
            />
            <div className="filters" role="tablist" aria-label="System views">
              {(
                [
                  ["health", "Health"],
                  ["metrics", "Metrics"],
                  ["feedback", "Feedback log"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={systemTab === id} onClick={() => setSystemTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {systemTab === "health" && (
              <SystemHealthPanel
                currentEnv={currentEnv}
                isWalletConnected={wallet.status === "CONNECTED"}
                walletNetwork={wallet.activeNetwork || wallet.networkId}
                activeContractAddress={escrowState.contractAddress}
              />
            )}
            {systemTab === "metrics" && <ProductMetricsView escrowState={escrowState} isIndexerLive={isIndexerLive} />}
            {systemTab === "feedback" && <FeedbackDashboard onLog={addLog} onOpenFeedback={() => setIsFeedbackOpen(true)} />}
          </div>
        );
      case "terms":
      case "privacy-policy":
        return <LegalPage kind={route} />;
    }
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>
        Skip to content
      </a>
      <Header
        wallet={wallet}
        isLiveMode={isLive}
        contractAddress={escrowState.contractAddress}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
        onNetworkChange={handleNetworkChange}
        activityCount={logs.length}
        onToggleActivity={() => setIsActivityOpen((v) => !v)}
      />

      <nav className="nav" aria-label="Sections">
        {NAV.map((g) => (
          <div className="nav-group" key={g.group}>
            <div className="nav-group-label">{g.group}</div>
            {g.items.map((item) => (
              <a
                key={item.id}
                href={`#/${item.id}`}
                className="nav-link"
                aria-current={route === item.id ? "page" : undefined}
              >
                <span className="nav-num">{item.num}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <main className="main" id="main" tabIndex={-1}>
        <SafetyBanner />

        {/* A missing extension is expected for first-time visitors; only surface it once they try to connect. */}
        {wallet.error && wallet.status !== "CONNECTED" && (wallet.errorCode !== "WALLET_UNAVAILABLE" || connectAttempted) && (
          <div id="wallet-diagnostic-banner" className="notice notice--bad" style={{ marginBottom: 24 }}>
            <div className="row-between">
              <div>
                <div className="notice-title">Wallet could not connect ({wallet.errorCode || wallet.status})</div>
                <div>
                  {wallet.error}
                  {wallet.errorCode === "WALLET_UNAVAILABLE" && (
                    <>
                      {" "}
                      Get it at{" "}
                      <a href="https://www.lace.io/" target="_blank" rel="noreferrer">
                        lace.io
                      </a>
                      . You can still use the walkthrough and simulation without it.
                    </>
                  )}
                </div>
              </div>
              <button
                className="btn btn--sm btn--danger"
                onClick={handleConnectWallet}
                disabled={wallet.status === "CONNECTING" || wallet.status === "DETECTING"}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {renderPage()}
      </main>

      <footer className="footer">
        <span>Pactra v0.6.0 on Midnight Preprod</span>
        <span className="footer-spacer" />
        <a href="#/terms">Terms of Service</a>
        <a href="#/privacy-policy">Privacy Policy</a>
        <a href="https://github.com/Kalpesh-ops/agent-commerce-midnight" target="_blank" rel="noreferrer">
          Source
        </a>
        <button className="linkbtn" onClick={() => setIsActivityOpen((v) => !v)}>
          Activity log
        </button>
        <button className="linkbtn" onClick={() => setIsFeedbackOpen(true)}>
          Feedback
        </button>
      </footer>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} onLog={addLog} />

      {isActivityOpen && (
        <ActivityDrawer entries={logs} onClose={() => setIsActivityOpen(false)} onClear={() => setLogs([])} />
      )}
    </div>
  );
};
