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
}

export class EscrowClientService {
  private state: EscrowContractData = {
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
  };

  public getState(): EscrowContractData {
    return { ...this.state };
  }

  public async createTask(params: {
    taskId: string;
    agentCommitment: string;
    maxBudget: number;
    conditionHash: string;
    creatorSecret: string;
  }): Promise<EscrowContractData> {
    if (this.state.taskState !== "UNINITIALIZED") {
      throw new Error("Compact Assert: Task is already initialized");
    }
    if (params.maxBudget <= 0) {
      throw new Error("Compact Assert: Max budget must be greater than zero");
    }

    // Simulate ZK proof generation & commitment hash
    const fakeCommitment = `0xcreator_${Math.abs(this.hashCode(params.creatorSecret)).toString(16).padStart(16, "0")}`;

    this.state = {
      ...this.state,
      taskId: params.taskId || `0xtask_${Date.now().toString(16)}`,
      creatorCommitment: fakeCommitment,
      agentCommitment: params.agentCommitment || "0xagent_a4f92d8b100c59e7",
      maxBudget: params.maxBudget,
      conditionHash: params.conditionHash || "0xcond_sha256_verification_spec_001",
      taskState: "CREATED",
      sequence: this.state.sequence + 1,
    };
    return this.getState();
  }

  public async fundTask(amount: number): Promise<EscrowContractData> {
    if (this.state.taskState !== "CREATED" && this.state.taskState !== "FUNDED") {
      throw new Error("Compact Assert: Task cannot be funded in current state");
    }
    if (amount <= 0) {
      throw new Error("Compact Assert: Deposit amount must be greater than zero");
    }
    if (this.state.escrowedAmount + amount > this.state.maxBudget) {
      throw new Error(`Compact Assert: Escrowed amount (${this.state.escrowedAmount + amount}) cannot exceed maximum budget (${this.state.maxBudget})`);
    }

    this.state = {
      ...this.state,
      escrowedAmount: this.state.escrowedAmount + amount,
      taskState: "FUNDED",
    };
    return this.getState();
  }

  public async acceptTask(): Promise<EscrowContractData> {
    if (this.state.taskState !== "FUNDED") {
      throw new Error("Compact Assert: Task must be FUNDED before it can be activated");
    }

    this.state = {
      ...this.state,
      taskState: "ACTIVE",
    };
    return this.getState();
  }

  public async submitCompletion(evidenceHash: string): Promise<EscrowContractData> {
    if (this.state.taskState !== "ACTIVE") {
      throw new Error("Compact Assert: Task must be ACTIVE to submit completion");
    }

    this.state = {
      ...this.state,
      completionHash: evidenceHash || `0xevidence_${Date.now().toString(16)}`,
      taskState: "COMPLETION_PENDING",
    };
    return this.getState();
  }

  public async settleTask(payoutAmount: number): Promise<EscrowContractData> {
    if (this.state.taskState !== "COMPLETION_PENDING") {
      throw new Error("Compact Assert: Task must be in COMPLETION_PENDING to settle");
    }
    if (this.state.settlementState !== "UNSETTLED") {
      throw new Error("Compact Assert: Settlement cannot happen twice");
    }
    if (payoutAmount <= 0) {
      throw new Error("Compact Assert: Payout amount must be greater than zero");
    }
    if (payoutAmount > this.state.escrowedAmount) {
      throw new Error(`Compact Assert: Payout (${payoutAmount}) cannot exceed escrowed funds (${this.state.escrowedAmount})`);
    }

    this.state = {
      ...this.state,
      taskState: "COMPLETED",
      settlementState: "SETTLED_SUCCESS",
    };
    return this.getState();
  }

  public async refundTask(): Promise<EscrowContractData> {
    const refundable = ["CREATED", "FUNDED", "ACTIVE", "COMPLETION_PENDING"].includes(this.state.taskState);
    if (!refundable) {
      throw new Error("Compact Assert: Task cannot be refunded in completed or already refunded state");
    }
    if (this.state.settlementState !== "UNSETTLED") {
      throw new Error("Compact Assert: Settlement already finalized");
    }

    this.state = {
      ...this.state,
      taskState: "REFUNDED",
      settlementState: "SETTLED_REFUND",
    };
    return this.getState();
  }

  public reset(): EscrowContractData {
    this.state = {
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
    };
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

export const escrowService = new EscrowClientService();
