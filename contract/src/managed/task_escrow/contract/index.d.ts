import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum TaskState { UNINITIALIZED = 0,
                        CREATED = 1,
                        FUNDED = 2,
                        ACTIVE = 3,
                        COMPLETION_PENDING = 4,
                        COMPLETED = 5,
                        REFUNDED = 6
}

export enum SettlementState { UNSETTLED = 0,
                              SETTLED_SUCCESS = 1,
                              SETTLED_REFUND = 2
}

export type Witnesses<PS> = {
  creatorSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  agentSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createTask(context: __compactRuntime.CircuitContext<PS>,
             newTaskId_0: Uint8Array,
             targetAgentCommitment_0: Uint8Array,
             budgetLimit_0: bigint,
             targetConditionHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  fundTask(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  acceptTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submitCompletion(context: __compactRuntime.CircuitContext<PS>,
                   evidenceHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settleTask(context: __compactRuntime.CircuitContext<PS>,
             payoutAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refundTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  createTask(context: __compactRuntime.CircuitContext<PS>,
             newTaskId_0: Uint8Array,
             targetAgentCommitment_0: Uint8Array,
             budgetLimit_0: bigint,
             targetConditionHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  fundTask(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  acceptTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submitCompletion(context: __compactRuntime.CircuitContext<PS>,
                   evidenceHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settleTask(context: __compactRuntime.CircuitContext<PS>,
             payoutAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refundTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  computeCommitment(sk_0: Uint8Array, salt_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  computeCommitment(context: __compactRuntime.CircuitContext<PS>,
                    sk_0: Uint8Array,
                    salt_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createTask(context: __compactRuntime.CircuitContext<PS>,
             newTaskId_0: Uint8Array,
             targetAgentCommitment_0: Uint8Array,
             budgetLimit_0: bigint,
             targetConditionHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  fundTask(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  acceptTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  submitCompletion(context: __compactRuntime.CircuitContext<PS>,
                   evidenceHash_0: Uint8Array): __compactRuntime.CircuitResults<PS, []>;
  settleTask(context: __compactRuntime.CircuitContext<PS>,
             payoutAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refundTask(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly taskId: Uint8Array;
  readonly creatorCommitment: Uint8Array;
  readonly agentCommitment: Uint8Array;
  readonly maxBudget: bigint;
  readonly escrowedAmount: bigint;
  readonly taskState: TaskState;
  readonly conditionHash: Uint8Array;
  readonly completionHash: Uint8Array;
  readonly settlementState: SettlementState;
  readonly sequence: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
