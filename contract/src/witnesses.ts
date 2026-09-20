import { Ledger } from "./managed/task_escrow/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

/**
 * Shape of the private state for the Task Escrow contract.
 * Contains secrets (e.g. user/creator private key or agent private key)
 * that never leak on-chain.
 */
export type TaskEscrowPrivateState = {
  readonly creatorSecretKey: Uint8Array;
  readonly agentSecretKey: Uint8Array;
};

export const createTaskEscrowPrivateState = (
  creatorSecretKey: Uint8Array = new Uint8Array(32),
  agentSecretKey: Uint8Array = new Uint8Array(32)
): TaskEscrowPrivateState => ({
  creatorSecretKey,
  agentSecretKey,
});

export const witnesses = {
  creatorSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, TaskEscrowPrivateState>): [
    TaskEscrowPrivateState,
    Uint8Array
  ] => [privateState, privateState.creatorSecretKey],

  agentSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, TaskEscrowPrivateState>): [
    TaskEscrowPrivateState,
    Uint8Array
  ] => [privateState, privateState.agentSecretKey],
};
