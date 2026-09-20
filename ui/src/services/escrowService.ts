import { contractClient, TxLifecycleEvent } from "./contractClient";
import { Ledger, TaskState, SettlementState } from "../../../contract/src/index.js";

export type TaskStateName =
  | "UNINITIALIZED"
  | "CREATED"
  | "FUNDED"
  | "ACTIVE"
  | "COMPLETION_PENDING"
  | "COMPLETED"
  | "REFUNDED";

export type SettlementStateName =
  | "UNSETTLED"
  | "SETTLED_SUCCESS"
  | "SETTLED_REFUND";

export interface EscrowContractData {
  contractAddress: string | null;
  taskId: string;
  creatorCommitment: string;
  agentCommitment: string;
  maxBudget: number;
  escrowedAmount: number;
  taskState: TaskStateName;
  conditionHash: string;
  completionHash: string;
  settlementState: SettlementStateName;
  sequence: number;
  isSimulated: boolean;
  confirmedBlock?: number;
  lastTxHash?: string;
}

function stateEnumToName(state: TaskState): TaskStateName {
  switch (state) {
    case TaskState.UNINITIALIZED: return "UNINITIALIZED";
    case TaskState.CREATED: return "CREATED";
    case TaskState.FUNDED: return "FUNDED";
    case TaskState.ACTIVE: return "ACTIVE";
    case TaskState.COMPLETION_PENDING: return "COMPLETION_PENDING";
    case TaskState.COMPLETED: return "COMPLETED";
    case TaskState.REFUNDED: return "REFUNDED";
    default: return "UNINITIALIZED";
  }
}

function settlementEnumToName(state: SettlementState): SettlementStateName {
  switch (state) {
    case SettlementState.UNSETTLED: return "UNSETTLED";
    case SettlementState.SETTLED_SUCCESS: return "SETTLED_SUCCESS";
    case SettlementState.SETTLED_REFUND: return "SETTLED_REFUND";
    default: return "UNSETTLED";
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stringOrHexToBytes32(input: string): Uint8Array {
  const result = new Uint8Array(32);
  if (input.startsWith("0x") && input.length >= 4) {
    const hex = input.slice(2);
    for (let i = 0; i < Math.min(32, hex.length / 2); i++) {
      result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16) || 0;
    }
  } else {
    const encoded = new TextEncoder().encode(input);
    result.set(encoded.slice(0, 32));
  }
  return result;
}

export class EscrowService {
  private liveState: EscrowContractData | null = null;
  private demoState: EscrowContractData = this.getInitialDemoState();
  private mode: "live" | "demo" = "demo";

  public getInitialDemoState(): EscrowContractData {
    return {
      contractAddress: null,
      taskId: "0x0000000000000000000000000000000000000000000000000000000000000000",
      creatorCommitment: "0x0000000000000000000000000000000000000000000000000000000000000000",
      agentCommitment: "0x0000000000000000000000000000000000000000000000000000000000000000",
      maxBudget: 0,
      escrowedAmount: 0,
      taskState: "UNINITIALIZED",
      conditionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      completionHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      settlementState: "UNSETTLED",
      sequence: 1,
      isSimulated: true,
    };
  }

  public setMode(mode: "live" | "demo") {
    this.mode = mode;
  }

  public getMode(): "live" | "demo" {
    return this.mode;
  }

  public getState(): EscrowContractData {
    if (this.mode === "live" && this.liveState) {
      return { ...this.liveState, isSimulated: false };
    }
    return { ...this.demoState, isSimulated: true };
  }

  /**
   * Reconstructs state from the live Midnight Preprod Indexer.
   */
  public async syncWithIndexer(contractAddress: string): Promise<EscrowContractData | null> {
    const onChainLedger = await contractClient.queryOnChainState(contractAddress);
    if (!onChainLedger) {
      return null;
    }

    this.liveState = {
      contractAddress,
      taskId: bytesToHex(onChainLedger.taskId),
      creatorCommitment: bytesToHex(onChainLedger.creatorCommitment),
      agentCommitment: bytesToHex(onChainLedger.agentCommitment),
      maxBudget: Number(onChainLedger.maxBudget),
      escrowedAmount: Number(onChainLedger.escrowedAmount),
      taskState: stateEnumToName(onChainLedger.taskState),
      conditionHash: bytesToHex(onChainLedger.conditionHash),
      completionHash: bytesToHex(onChainLedger.completionHash),
      settlementState: settlementEnumToName(onChainLedger.settlementState),
      sequence: Number(onChainLedger.sequence),
      isSimulated: false,
    };
    this.mode = "live";
    return this.getState();
  }

  /**
   * Deploys a new real contract on Midnight Preprod via Lace.
   */
  public async deployOnPreprod(onStatus?: (event: TxLifecycleEvent) => void): Promise<string> {
    if (onStatus) contractClient.setLifecycleListener(onStatus);
    const contractAddress = await contractClient.deployOnChain("preprod");
    await this.syncWithIndexer(contractAddress);
    return contractAddress;
  }

  /**
   * Join an existing deployed contract.
   */
  public async joinDeployed(contractAddress: string): Promise<EscrowContractData | null> {
    await contractClient.joinContract(contractAddress, "preprod");
    return this.syncWithIndexer(contractAddress);
  }

  public async createTask(params: {
    taskId: string;
    agentCommitment: string;
    maxBudget: number;
    conditionHash: string;
    creatorSecret: string;
  }, onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const taskIdBytes = stringOrHexToBytes32(params.taskId);
      const agentPkBytes = stringOrHexToBytes32(params.agentCommitment);
      const conditionBytes = stringOrHexToBytes32(params.conditionHash);

      const tx = await contractClient.callCreateTask(
        taskIdBytes,
        agentPkBytes,
        BigInt(params.maxBudget),
        conditionBytes
      );

      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    // Demo / fallback simulation mode
    const simulatedCommitment = `0xcreator_${Math.abs(this.hashCode(params.creatorSecret)).toString(16).padStart(16, "0")}`;
    this.demoState = {
      ...this.demoState,
      taskId: params.taskId || `0xtask_${Date.now().toString(16)}`,
      creatorCommitment: simulatedCommitment,
      agentCommitment: params.agentCommitment || "0xagent_a4f92d8b100c59e7",
      maxBudget: params.maxBudget,
      conditionHash: params.conditionHash || "0xcond_sha256_verification_spec_001",
      taskState: "CREATED",
      sequence: this.demoState.sequence + 1,
      isSimulated: true,
    };
    return this.getState();
  }

  public async fundTask(amount: number, onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const tx = await contractClient.callFundTask(BigInt(amount));
      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    if (this.demoState.escrowedAmount + amount > this.demoState.maxBudget) {
      throw new Error(`Deposit exceeds max budget (${this.demoState.maxBudget})`);
    }
    this.demoState = {
      ...this.demoState,
      escrowedAmount: this.demoState.escrowedAmount + amount,
      taskState: "FUNDED",
      isSimulated: true,
    };
    return this.getState();
  }

  public async acceptTask(onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const tx = await contractClient.callAcceptTask();
      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    this.demoState = {
      ...this.demoState,
      taskState: "ACTIVE",
      isSimulated: true,
    };
    return this.getState();
  }

  public async submitCompletion(evidenceHash: string, onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const evidenceBytes = stringOrHexToBytes32(evidenceHash);
      const tx = await contractClient.callSubmitCompletion(evidenceBytes);
      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    this.demoState = {
      ...this.demoState,
      completionHash: evidenceHash,
      taskState: "COMPLETION_PENDING",
      isSimulated: true,
    };
    return this.getState();
  }

  public async settleTask(payoutAmount: number, onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const tx = await contractClient.callSettleTask(BigInt(payoutAmount));
      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    this.demoState = {
      ...this.demoState,
      taskState: "COMPLETED",
      settlementState: "SETTLED_SUCCESS",
      isSimulated: true,
    };
    return this.getState();
  }

  public async refundTask(onStatus?: (event: TxLifecycleEvent) => void): Promise<EscrowContractData> {
    if (this.mode === "live" && contractClient.getActiveContractAddress()) {
      if (onStatus) contractClient.setLifecycleListener(onStatus);
      const tx = await contractClient.callRefundTask();
      const contractAddr = contractClient.getActiveContractAddress()!;
      await this.syncWithIndexer(contractAddr);
      if (this.liveState) {
        this.liveState.lastTxHash = tx.public.txHash;
        this.liveState.confirmedBlock = tx.public.blockHeight;
      }
      return this.getState();
    }

    this.demoState = {
      ...this.demoState,
      taskState: "REFUNDED",
      settlementState: "SETTLED_REFUND",
      isSimulated: true,
    };
    return this.getState();
  }

  public resetDemo(): EscrowContractData {
    this.demoState = this.getInitialDemoState();
    return this.getState();
  }

  private hashCode(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
  }
}

export const escrowService = new EscrowService();
