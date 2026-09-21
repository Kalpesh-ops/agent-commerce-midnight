# Pactra Smart Contract Audit Preparation Package

> **CLASSIFICATION:** Formal Audit Readiness & Invariant Specification  
> **TARGET CONTRACT:** `contract/src/task_escrow.compact`  
> **LANGUAGE & VERSION:** Compact Language Version `0.23`  
> **PROTOCOL:** Pactra Autonomous Agent Escrow on Midnight Network  
> *NOTICE: This document is an audit preparation package authored by the engineering team to facilitate a third-party security audit. It does not constitute a formal external audit certification until completed by an accredited security firm.*

---

## 1. Executive Summary & Contract Architecture

The `TaskEscrow` smart contract provides privacy-preserving, non-custodial economic coordination between human users (Creators), autonomous AI agents (Agents), service providers, and arbiters on the Midnight Network.

### Primary Design Invariant
> **"The agent receives bounded economic authority over locked escrow funds, never custody of the user's private keys or wallet treasury."**

### Contract State Machine
```
                     ┌───────────────────┐
                     │   UNINITIALIZED   │
                     └─────────┬─────────┘
                               │ createTask()
                               ▼
                     ┌───────────────────┐
                     │      CREATED      │◄────────────────────────┐
                     └─────────┬─────────┘                         │
                               │ fundTask()                        │
                               ▼                                   │
                     ┌───────────────────┐                         │
                     │      FUNDED       │                         │
                     └─────────┬─────────┘                         │
                               │ acceptTask()                      │
                               ▼                                   │ refundTask()
                     ┌───────────────────┐                         │
                     │      ACTIVE       │                         │
                     └─────────┬─────────┘                         │
                               │ submitCompletion()                │
                               ▼                                   │
                     ┌───────────────────┐                         │
                     │COMPLETION_PENDING │─────────────────────────┘
                     └─────────┬─────────┘
                               │ settleTask()
                               ▼
                     ┌───────────────────┐
                     │     COMPLETED     │ (Terminal - Succeeded)
                     └───────────────────┘

                     ┌───────────────────┐
                     │     REFUNDED      │ (Terminal - Refunded)
                     └───────────────────┘
```

---

## 2. Ledger State & Observable Fields

The contract declares observable ledger state fields on the Midnight public ledger:

| Field | Type | Accessibility | Description |
| :--- | :--- | :--- | :--- |
| `taskId` | `Bytes<32>` | Public Ledger | Unique 32-byte identifier for the task escrow. |
| `creatorCommitment` | `Bytes<32>` | Public Ledger | Cryptographic commitment $H(\text{"agent-commerce:pk:"}, \text{seq}, sk_{\text{creator}})$. |
| `agentCommitment` | `Bytes<32>` | Public Ledger | Commitment of the authorized autonomous agent. |
| `maxBudget` | `Uint<64>` | Public Ledger | Hard ceiling on total funds that can ever be locked. |
| `escrowedAmount` | `Uint<64>` | Public Ledger | Current amount of DUST locked in the contract instance. |
| `taskState` | `TaskState` (enum) | Public Ledger | Current lifecycle state (0 to 6). |
| `conditionHash` | `Bytes<32>` | Public Ledger | Cryptographic root commitment of the objective completion conditions. |
| `completionHash` | `Bytes<32>` | Public Ledger | Hash of the execution evidence submitted by the agent/provider. |
| `settlementState` | `SettlementState` (enum)| Public Ledger | Terminal settlement status: `UNSETTLED`, `SETTLED_SUCCESS`, `SETTLED_REFUND`. |
| `sequence` | `Counter` | Public Ledger | Monotonically increasing counter for state transitions and replay protection. |

---

## 3. Circuit Analysis & Specification

### Circuit 1: `createTask(newTaskId, targetAgentCommitment, budgetLimit, targetConditionHash)`
- **Preconditions**:
  - `taskState == TaskState.UNINITIALIZED`
  - `budgetLimit > 0`
- **Witnesses Used**: `creatorSecretKey()`
- **Effects**:
  - Sets `creatorCommitment = computeCommitment(creatorSecretKey(), sequence)`
  - Initializes `taskId`, `agentCommitment`, `maxBudget`, and `conditionHash`
  - Sets `taskState = TaskState.CREATED`
- **Security Check**: Cannot be called on an already-created or active task.

### Circuit 2: `fundTask(amount)`
- **Preconditions**:
  - `taskState == TaskState.CREATED || taskState == TaskState.FUNDED`
  - Caller proves knowledge of `creatorSecretKey()` matching `creatorCommitment`
  - `amount > 0`
  - `escrowedAmount + amount <= maxBudget` (strict budget ceiling)
- **Effects**:
  - Increases `escrowedAmount` by `amount`
  - Sets `taskState = TaskState.FUNDED`
- **Security Check**: Prevents overfunding beyond `maxBudget`; rejects unauthorized depositors.

### Circuit 3: `acceptTask()`
- **Preconditions**:
  - `taskState == TaskState.FUNDED`
  - Caller proves knowledge of `agentSecretKey()` matching `agentCommitment`
- **Effects**:
  - Sets `taskState = TaskState.ACTIVE`
- **Security Check**: Rejects activation by any party other than the designated agent.

### Circuit 4: `submitCompletion(evidenceHash)`
- **Preconditions**:
  - `taskState == TaskState.ACTIVE`
  - Caller proves knowledge of `agentSecretKey()` matching `agentCommitment`
- **Effects**:
  - Sets `completionHash = disclose(evidenceHash)`
  - Sets `taskState = TaskState.COMPLETION_PENDING`
- **Security Check**: Rejects evidence submission from unauthorized third parties or unactivated tasks.

### Circuit 5: `settleTask(payoutAmount)`
- **Preconditions**:
  - `taskState == TaskState.COMPLETION_PENDING`
  - Caller proves knowledge of `creatorSecretKey()` matching `creatorCommitment`
  - `settlementState == SettlementState.UNSETTLED` (strict single settlement)
  - `payoutAmount > 0`
  - `payoutAmount <= escrowedAmount`
- **Effects**:
  - Sets `settlementState = SettlementState.SETTLED_SUCCESS`
  - Sets `taskState = TaskState.COMPLETED`
- **Security Check**: Double-spend prevention; payout cannot exceed locked funds.

### Circuit 6: `refundTask()`
- **Preconditions**:
  - `taskState` in `[CREATED, FUNDED, ACTIVE, COMPLETION_PENDING]`
  - Caller proves knowledge of `creatorSecretKey()` matching `creatorCommitment`
  - `settlementState == SettlementState.UNSETTLED`
- **Effects**:
  - Sets `settlementState = SettlementState.SETTLED_REFUND`
  - Sets `taskState = TaskState.REFUNDED`
- **Security Check**: Cannot refund after settlement; mutual exclusivity between success and refund.

---

## 4. Formal Invariant Checklist (10 Core Invariants)

The following 10 invariants are mathematically required and tested:

1. **Single Settlement Invariant:** Funds can never settle twice. `settleTask` enforces `settlementState == SettlementState.UNSETTLED` and transitions to `SETTLED_SUCCESS`.
2. **Mutual Exclusivity Invariant:** Refund and settlement cannot both succeed. If `settlementState != UNSETTLED`, subsequent calls to `settleTask` or `refundTask` revert.
3. **Protected State Mutation Invariant:** Unauthorized actors cannot mutate protected task state. Only the creator witness can fund, settle, or refund; only the agent witness can accept or submit completion.
4. **Agent Authority Ceiling Invariant:** Agent procurement authority is strictly bounded by the `TaskPolicyEnvelope`. The agent cannot initiate requests outside approved categories or exceeding individual spend limits.
5. **Budget Overflow Invariant:** Escrow deposits can never exceed `maxBudget`. `fundTask` asserts `escrowedAmount + amount <= maxBudget`.
6. **Expiry & Inactive Protection:** Inactive or terminal tasks cannot execute active-phase transitions. `submitCompletion` reverts unless `taskState == ACTIVE`.
7. **Objective Evidence Integrity:** Completion settlement requires verifiable execution evidence. `submitCompletion` anchors `completionHash` which must verify against `conditionHash`.
8. **Dispute Non-Bypass Invariant:** Contested tasks cannot settle unilaterally. A registered dispute routes resolution through the multi-party `ArbitrationBoard`.
9. **Arbitration Anti-Replay Invariant:** Arbitration resolutions cannot be replayed. Disputed jobs and evidence hashes are added to `spentDisputeIds`.
10. **State Sequence Monotonicity:** Sequence counter increments with state transitions, preventing replay of stale witness signatures.

---

## 5. Arithmetic & Balance Assumptions

- **Bit Width:** Amounts are represented as `Uint<64>` (0 to $2^{64} - 1$).
- **Overflow Protection:** Midnight Compact compiler enforces checked integer arithmetic. In addition, `fundTask` and `settleTask` perform explicit boundary checks (`escrowedAmount + amount <= maxBudget`, `payoutAmount <= escrowedAmount`).
- **Precision:** DUST tokens use 6 decimal places of precision ($1 \text{ DUST} = 1,000,000 \text{ specks}$).

---

## 6. Privacy & Witness Assumptions

- **Private Witnesses:** `creatorSecretKey()` and `agentSecretKey()` are 32-byte witness preimages. They are passed directly into the ZK prover in client memory and are **never disclosed** on-chain.
- **Commitment Scheme:** `computeCommitment(sk, salt)` utilizes Midnight's collision-resistant `persistentHash`.
- **Application Privacy:** Task prompts, dataset contents, and uncommitted agent reasoning traces remain strictly in local off-chain storage.

---

## 7. Toolchain & Compilation Environment

- **Compiler:** Midnight Compact compiler version `0.23`
- **Runtime Dependencies:**
  - `@midnight-ntwrk/compact-runtime`
  - `@midnight-ntwrk/midnight-js-contracts`
  - `@midnight-ntwrk/midnight-js-protocol`
- **Compilation Command:**
  ```bash
  npm run compile:contract
  ```
- **Test Suite Command:**
  ```bash
  npm run test
  ```
