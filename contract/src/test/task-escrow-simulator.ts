import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  convertFieldToBytes,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
  pureCircuits,
} from "../managed/task_escrow/contract/index.js";
import {
  type TaskEscrowPrivateState,
  createTaskEscrowPrivateState,
  witnesses,
} from "../witnesses.js";

/**
 * In-memory simulator for the TaskEscrow contract, executing circuits
 * against local compact runtime state without needing a live network.
 */
export class TaskEscrowSimulator {
  readonly contract: Contract<TaskEscrowPrivateState>;
  circuitContext: CircuitContext<TaskEscrowPrivateState>;

  constructor(
    creatorSecretKey: Uint8Array = new Uint8Array(32),
    agentSecretKey: Uint8Array = new Uint8Array(32),
  ) {
    this.contract = new Contract<TaskEscrowPrivateState>(witnesses);
    const initialPrivateState = createTaskEscrowPrivateState(
      creatorSecretKey,
      agentSecretKey,
    );
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext(initialPrivateState, "0".repeat(64)),
    );

    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): TaskEscrowPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public setCallerKeys(creatorSecretKey: Uint8Array, agentSecretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      creatorSecretKey,
      agentSecretKey,
    };
  }

  public computeCommitment(secretKey: Uint8Array): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "task-escrow-simulator.ts",
    );
    return pureCircuits.computeCommitment(secretKey, sequence);
  }

  public createTask(
    newTaskId: Uint8Array,
    targetAgentCommitment: Uint8Array,
    budgetLimit: bigint,
    targetConditionHash: Uint8Array,
  ): Ledger {
    this.circuitContext = this.contract.impureCircuits.createTask(
      this.circuitContext,
      newTaskId,
      targetAgentCommitment,
      budgetLimit,
      targetConditionHash,
    ).context;
    return this.getLedger();
  }

  public fundTask(amount: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.fundTask(
      this.circuitContext,
      amount,
    ).context;
    return this.getLedger();
  }

  public acceptTask(): Ledger {
    this.circuitContext = this.contract.impureCircuits.acceptTask(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }

  public submitCompletion(evidenceHash: Uint8Array): Ledger {
    this.circuitContext = this.contract.impureCircuits.submitCompletion(
      this.circuitContext,
      evidenceHash,
    ).context;
    return this.getLedger();
  }

  public settleTask(payoutAmount: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.settleTask(
      this.circuitContext,
      payoutAmount,
    ).context;
    return this.getLedger();
  }

  public refundTask(): Ledger {
    this.circuitContext = this.contract.impureCircuits.refundTask(
      this.circuitContext,
    ).context;
    return this.getLedger();
  }
}
