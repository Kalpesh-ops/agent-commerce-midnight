import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import * as CompiledTaskEscrow from "./managed/task_escrow/contract/index.js";
import * as Witnesses from "./witnesses.js";

export * from "./managed/task_escrow/contract/index.js";
export * from "./witnesses.js";
export * from "./pactra/index.js";

export const CompiledTaskEscrowContract = CompiledContract.make<
  CompiledTaskEscrow.Contract<Witnesses.TaskEscrowPrivateState>
>("TaskEscrow", CompiledTaskEscrow.Contract<Witnesses.TaskEscrowPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/task_escrow"),
);
