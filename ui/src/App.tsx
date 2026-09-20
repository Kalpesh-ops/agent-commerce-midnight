import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { EscrowTimeline } from "./components/EscrowTimeline";
import { TaskDetailsCard } from "./components/TaskDetailsCard";
import { RoleActionPanel } from "./components/RoleActionPanel";
import { PrivacyModelInspector } from "./components/PrivacyModelInspector";
import { walletService, WalletState } from "./services/wallet";
import { escrowService, EscrowContractData } from "./services/escrowService";
import { MidnightNetworkId } from "./types/midnight";

export const App: React.FC = () => {
  const [wallet, setWallet] = useState<WalletState>({
    isInstalled: false,
    isConnected: false,
    networkId: "preprod",
  });

  const [escrowState, setEscrowState] = useState<EscrowContractData>(
    escrowService.getState()
  );

  const [logs, setLogs] = useState<Array<{ text: string; type: "info" | "success" | "error" }>>([
    { text: "Midnight Agent Commerce Protocol initialized.", type: "info" },
    { text: "Target Network: Midnight Preprod Testnet.", type: "info" },
  ]);

  const addLog = (text: string, type: "info" | "success" | "error" = "info") => {
    setLogs((prev) => [{ text: `[${new Date().toLocaleTimeString()}] ${text}`, type }, ...prev.slice(0, 30)]);
  };

  useEffect(() => {
    const isInstalled = walletService.isLaceInstalled();
    setWallet((prev) => ({ ...prev, isInstalled }));
    if (isInstalled) {
      addLog("Midnight Lace wallet extension detected.", "success");
    } else {
      addLog("No active Midnight browser extension found (simulation mode active).", "info");
    }
  }, []);

  const handleConnectWallet = async () => {
    addLog(`Initiating handshake with Midnight Lace on ${wallet.networkId}...`, "info");
    const res = await walletService.connect(wallet.networkId);
    setWallet(res);
    if (res.isConnected) {
      addLog(`Wallet connected successfully! Shielded Coin PK: ${res.coinPublicKey?.slice(0, 16)}...`, "success");
    } else {
      addLog(res.error || "Wallet connection cancelled or unavailable.", "error");
    }
  };

  const handleNetworkChange = (net: MidnightNetworkId) => {
    setWallet((prev) => ({ ...prev, networkId: net, isConnected: false }));
    addLog(`Switched network target to ${net}.`, "info");
  };

  const handleCreateTask = async (budget: number) => {
    try {
      addLog(`Generating ZK proof for createTask circuit (Budget: ${budget})...`, "info");
      const newState = await escrowService.createTask({
        taskId: `0xtask_${Date.now().toString(16)}`,
        agentCommitment: "0xagent_pk_88a3f5912e7bc401",
        maxBudget: budget,
        conditionHash: "0xcond_sha256_dataset_clean_verified",
        creatorSecret: "creator_entropy_seed_secret",
      });
      setEscrowState(newState);
      addLog(`Task created! Task ID: ${newState.taskId}`, "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleFundTask = async (amount: number) => {
    try {
      addLog(`Executing fundTask circuit deposit: ${amount} DUST/NIGHT...`, "info");
      const newState = await escrowService.fundTask(amount);
      setEscrowState(newState);
      addLog(`Task funded! New escrow balance: ${newState.escrowedAmount} DUST.`, "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleAcceptTask = async () => {
    try {
      addLog("Agent proving identity commitment with local agentSecretKey witness...", "info");
      const newState = await escrowService.acceptTask();
      setEscrowState(newState);
      addLog("Task accepted! State changed to ACTIVE.", "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleSubmitCompletion = async (evidenceHash: string) => {
    try {
      addLog(`Agent submitting task completion evidence hash: ${evidenceHash.slice(0, 20)}...`, "info");
      const newState = await escrowService.submitCompletion(evidenceHash);
      setEscrowState(newState);
      addLog("Evidence submitted! State changed to COMPLETION_PENDING.", "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleSettleTask = async (payoutAmount: number) => {
    try {
      addLog(`Task Creator verifying conditions and releasing ${payoutAmount} payout to agent...`, "info");
      const newState = await escrowService.settleTask(payoutAmount);
      setEscrowState(newState);
      addLog("Task settled! Payout released to agent. State changed to COMPLETED.", "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleRefundTask = async () => {
    try {
      addLog("Task Creator reclaiming escrowed funds via refundTask circuit...", "info");
      const newState = await escrowService.refundTask();
      setEscrowState(newState);
      addLog("Task refunded! Escrowed funds returned to creator.", "success");
    } catch (err: any) {
      addLog(err.message, "error");
    }
  };

  const handleReset = () => {
    const newState = escrowService.reset();
    setEscrowState(newState);
    addLog("Protocol state reset to UNINITIALIZED.", "info");
  };

  return (
    <div className="app-container">
      <Header
        wallet={wallet}
        onConnect={handleConnectWallet}
        onNetworkChange={handleNetworkChange}
      />

      <section className="vision-banner">
        <h2>Autonomous Agent Commerce & Escrow Protocol</h2>
        <p>
          A privacy-preserving economic operating system for autonomous AI agents on Midnight.
          AI agents operate with bounded budgets, capability-based permissions, and zero-knowledge proof verification.
        </p>
        <div className="security-badge">
          <span>🔒</span> Core Security Invariant: The agent NEVER has unrestricted access to the user treasury.
        </div>
      </section>

      <EscrowTimeline
        taskState={escrowState.taskState}
        settlementState={escrowState.settlementState}
      />

      <div className="dashboard-grid">
        <TaskDetailsCard data={escrowState} />
        <RoleActionPanel
          data={escrowState}
          onCreateTask={handleCreateTask}
          onFundTask={handleFundTask}
          onAcceptTask={handleAcceptTask}
          onSubmitCompletion={handleSubmitCompletion}
          onSettleTask={handleSettleTask}
          onRefundTask={handleRefundTask}
          onReset={handleReset}
        />
      </div>

      <PrivacyModelInspector />

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
