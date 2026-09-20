# Pactra — Autonomous Agent Commerce & Escrow Protocol (Midnight Network)

> **Level 1 Foundation**: A privacy-preserving economic operating system for autonomous AI agents built on the Midnight Network using Compact smart contracts and zero-knowledge proofs.

---

## 1. Project Vision

In the emerging autonomous agent economy, AI agents act on behalf of users to plan objectives, negotiate resources, and procure APIs and computational services. However, granting autonomous agents unrestricted access to a user's cryptocurrency treasury introduces catastrophic financial and security risks:
- Prompt injection and jailbreaks leading to treasury drain.
- Hallucinations triggering runaway micro-transactions.
- Untrusted counterparty services extorting unbounded fees.

### The Midnight Solution
**Pactra** solves this by establishing a zero-knowledge economic sandbox:
1. **Bounded Operating Budgets:** Agents operate strictly within user-configured spending bounds enforced by on-chain constraints.
2. **Capability-Based Permissions:** Agents receive task-specific permissions, not raw private keys or treasury access.
3. **Objective Completion Verification:** Escrow payouts occur only when objective completion conditions are verified cryptographically.
4. **Zero-Knowledge Privacy:** Task parameters, agent planning logic, and private credentials remain shielded, keeping only commitments and state transitions on-chain.

---

## 2. Protocol Architecture

The monorepo follows the recommended Midnight Network project structure:

```
agent-commerce-midnight/
├── contract/                       # Compact Smart Contract & Simulator Tests
│   ├── src/
│   │   ├── task_escrow.compact     # Official Compact smart contract (Language 0.23)
│   │   ├── witnesses.ts            # Local witness definitions for private state
│   │   ├── index.ts                # Package exports
│   │   └── test/
│   │       ├── task-escrow-simulator.ts  # In-memory Compact runtime simulator harness
│   │       ├── task-escrow.test.ts       # 21 comprehensive Vitest unit tests
│   │       └── utils.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── ui/                             # Modern TypeScript DApp Frontend
│   ├── src/
│   │   ├── components/             # Header, EscrowTimeline, TaskDetailsCard,
│   │   │                           # RoleActionPanel, PrivacyModelInspector
│   │   ├── services/
│   │   │   ├── wallet.ts           # Midnight Lace wallet connector (window.midnight API v4.x)
│   │   │   └── escrowService.ts    # Client protocol state machine & ZK witness manager
│   │   ├── types/midnight.ts       # DApp connector interfaces
│   │   ├── index.css               # Midnight cyberpunk glassmorphic design system
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── scripts/
│   ├── compile.js                  # Cross-platform Compact compiler runner
│   └── deploy.ts                   # Preprod testnet deployment & indexer verification script
├── package.json                    # Workspace root
└── tsconfig.base.json
```

---

## 3. Compact Smart Contract Primitive (`task_escrow.compact`)

### State Machine Lifecycle
```
[ UNINITIALIZED ]
        │
        │ createTask()  (Creator only, sets maxBudget > 0, agentCommitment)
        ▼
   [ CREATED ]
        │
        │ fundTask()    (Creator only, deposits escrow balance <= maxBudget)
        ▼
   [ FUNDED ] ──────────────┐
        │                   │
        │ acceptTask()      │
        │ (Agent only)      │ refundTask()
        ▼                   │ (Creator only: cancel / expire)
    [ ACTIVE ] ─────────────┤
        │                   │
        │ submitCompletion()│
        │ (Agent only)      │
        ▼                   │
[ COMPLETION_PENDING ] ─────┘
        │
        │ settleTask()  (Creator / verifier settles payout <= escrowed amount)
        ▼
  [ COMPLETED ]
 (SETTLED_SUCCESS)
```

### Observable (Public) Ledger State
| Field | Type | Description |
|---|---|---|
| `taskId` | `Bytes<32>` | Unique identifier hash for the task envelope |
| `creatorCommitment` | `Bytes<32>` | Persistent hash commitment of creator's secret identity |
| `agentCommitment` | `Bytes<32>` | Persistent hash commitment of authorized agent's secret identity |
| `maxBudget` | `Uint<64>` | Strict upper-bound spending limit for this task |
| `escrowedAmount` | `Uint<64>` | Currently deposited escrow balance |
| `taskState` | `TaskState` | Current stage (`CREATED`, `FUNDED`, `ACTIVE`, `COMPLETION_PENDING`, `COMPLETED`, `REFUNDED`) |
| `conditionHash` | `Bytes<32>` | Hash commitment of the task completion criteria |
| `completionHash` | `Bytes<32>` | Result/evidence hash submitted by the agent |
| `settlementState` | `SettlementState`| `UNSETTLED`, `SETTLED_SUCCESS`, `SETTLED_REFUND` |
| `sequence` | `Counter` | Monotonic counter preventing replay attacks |

---

## 4. Privacy Model

| Protocol Data | Visibility | Enforcement Mechanism |
|---|---|---|
| **User Treasury & Private Keys** | **Strictly Private (Local)** | Never exposed on-chain. Managed exclusively through Midnight Lace wallet connector API. |
| **Agent Internal Reasoning & Prompts** | **Strictly Private (Local)** | Off-chain agent execution environment. |
| **Creator & Agent Identities** | **Shielded (Zero-Knowledge)** | Proved via witness functions (`creatorSecretKey()`, `agentSecretKey()`) through `computeCommitment` ZK circuits without revealing keys. |
| **Escrow Bounds & Balances** | **Observable (Public)** | Enforced via Compact on-chain ledger to ensure verifiable financial settlement. |
| **Task State & Hashes** | **Observable (Public)** | Cryptographic digests (`Bytes<32>`) coordinating multi-party state progression. |

---

## 5. Threat Model & Security Invariants

1. **Rogue Agent Treasury Drain:**
   - *Mitigation:* The agent never has access to the user's wallet or private keys. The agent can only claim up to the `escrowedAmount`, which is mathematically capped at `maxBudget`.
2. **Unauthorized State Tampering:**
   - *Mitigation:* Only the creator can call `fundTask`, `settleTask`, or `refundTask`. Only the authorized agent whose secret key satisfies `agentCommitment` can call `acceptTask` and `submitCompletion`.
3. **Double Settlement / Replay Attacks:**
   - *Mitigation:* `settleTask` enforces `settlementState == SettlementState.UNSETTLED` and transitions to `SETTLED_SUCCESS`. Once settled, no further payouts or refunds are permitted.
4. **Over-budget Deposits:**
   - *Mitigation:* `fundTask` asserts `escrowedAmount + amount <= maxBudget`.

---

## 6. Target Network & Deployment Information

### Environment Modes
1. **Automated Simulator Tests:** 21 automated unit tests run against an in-memory `@midnight-ntwrk/compact-runtime` instance without requiring network access.
2. **Local DApp Development:** The frontend client (`http://localhost:3000`) provides an interactive simulation testbed that seamlessly switches to live Midnight Lace wallet transactions upon browser connection.
3. **Live Midnight Preprod Testnet:** Verified live connectivity to Midnight Preprod network services:

| Parameter | Configuration / Live Status |
|---|---|
| **Target Environment** | `Midnight Preprod Testnet` |
| **Network ID** | `preprod` |
| **Indexer Endpoint** | `https://indexer.preprod.midnight.network/api/v4/graphql` (Status: **LIVE**, Epoch `994406`) |
| **Indexer WebSocket** | `wss://indexer.preprod.midnight.network/api/v4/graphql/ws` |
| **Node RPC Endpoint** | `https://rpc.preprod.midnight.network` |
| **Faucet Endpoint** | `https://midnight-tmnight-preprod.nethermind.dev/` |
| **Compiled Contract Artifact** | `contract/src/managed/task_escrow/contract/index.js` |
| **Contract SHA-256 Digest** | `3b8453a460502628f9275532600121bbefe23d7fde5cd5f522a6c6a35c48641a` |
| **Deployment Status** | `Pending User-Authorized Transaction` |

> [!NOTE]
> **On-Chain Deployment Procedure:**
> In Midnight Network, contract deployment transactions require Zero-Knowledge proof generation and wallet fee balancing using tNight/Dust tokens. In compliance with security standards, the repository contains no custodial private keys or pre-funded seed phrases.
> To broadcast the on-chain deployment to Preprod:
> 1. Start the DApp: `npm run dev:ui`
> 2. Open `http://localhost:3000` in a browser with the Midnight Lace wallet extension installed.
> 3. Connect to the Preprod network in Lace and request tNight tokens from the [Nethermind Faucet](https://midnight-tmnight-preprod.nethermind.dev/).
> 4. Authorize the contract deployment transaction through the Lace DApp connector prompt.

---

## 7. Setup & Execution Instructions

### Prerequisites
- Node.js `v24.x` (or `>= 24.11.1`)
- npm `11.x`
- Midnight Compact Compiler (`compact 0.5.2` via native CLI or WSL2 Ubuntu)
- Midnight Lace Wallet browser extension (configured to Preprod Testnet)

### 1. Install Dependencies
```bash
# Install contract package dependencies
npm install --prefix contract

# Install UI package dependencies
npm install --prefix ui
```

### 2. Compile Compact Smart Contract
```bash
npm run compile:contract
```
*Output: Compiles `task_escrow.compact` into TypeScript interfaces, ZK intermediate representation (`zkir`), and proving keys in `contract/src/managed/task_escrow`.*

### 3. Run Automated Unit Tests
```bash
npm run test:contract
```
*Executes 21 unit tests covering all state transitions, invalid transitions, and authorization invariants via `@midnight-ntwrk/compact-runtime`.*

### 4. Typecheck Codebase
```bash
npm run typecheck
```

### 5. Build Frontend Production Bundle
```bash
npm run build:ui
```

### 6. Verify Preprod Network & Artifacts
```bash
node scripts/deploy.ts
```

### 7. Launch Frontend DApp
```bash
npm run dev:ui
```
*Open `http://localhost:3000` in your browser to interact with the Task Escrow protocol, connect your Midnight Lace wallet, and test creator/agent workflows.*

---

## 8. Current Limitations (Level 1)

1. **Static Condition Hashes:** In Level 1, the objective completion condition is represented as a cryptographic hash commitment (`Bytes<32>`). Level 2 will introduce automated oracle and verifier circuits for dynamic off-chain proof verification.
2. **Single-Agent Binding:** Level 1 contracts bind an individual authorized agent commitment. Multi-agent consortiums and sub-delegation are planned for Level 2.
3. **Dust / Gas Balancing:** Direct wallet balancing in the browser relies on the Lace wallet's unsealed transaction balancing API. For headless automated agent runners, an agent wallet daemon will be integrated in Level 2.
