# Pactra — Privacy-Preserving Economic Operating Layer for Autonomous AI Agents

> **Level 3 Production Protocol**: A generalized, privacy-first economic operating system built on the Midnight Network for autonomous AI agents. Enables bounded resource procurement, cryptographic policy enforcement, multi-party threshold arbitration, and zero-knowledge escrow settlement without giving agents custody of user funds.

[![Pactra Protocol CI](https://github.com/kalpeshparashar/agent-commerce-midnight/actions/workflows/ci.yaml/badge.svg)](https://github.com/kalpeshparashar/agent-commerce-midnight/actions/workflows/ci.yaml)
[![Midnight Network](https://img.shields.io/badge/Network-Midnight%20Preprod-7045ff.svg)](https://midnight.network)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Tests Passing](https://img.shields.io/badge/Tests-70%20Passing-00e699.svg)](contract/src/test)

---

## Table of Contents
1. [The Problem](#1-the-problem)
2. [Why Autonomous Agents Need Economic Infrastructure](#2-why-autonomous-agents-need-economic-infrastructure)
3. [Pactra Architecture](#3-pactra-architecture)
4. [Security Model](#4-security-model)
5. [Privacy Model & Selective Disclosure](#5-privacy-model--selective-disclosure)
6. [Procurement Lifecycle](#6-procurement-lifecycle)
7. [Verification Model](#7-verification-model)
8. [Multi-Party Dispute & Arbitration Model](#8-multi-party-dispute--arbitration-model)
9. [Midnight Network Integration](#9-midnight-network-integration)
10. [Local Development](#10-local-development)
11. [Midnight Preprod Testnet Deployment](#11-midnight-preprod-testnet-deployment)
12. [Testing Suite](#12-testing-suite)
13. [Threat Model & Attack Analysis](#13-threat-model--attack-analysis)
14. [Current Implemented Functionality vs Limitations](#14-current-implemented-functionality-vs-limitations)
15. [Roadmap](#15-roadmap)

---

## 1. The Problem

Autonomous AI agents are transitioning from conversational assistants to goal-directed systems capable of executing multi-step workflows: compiling software, orchestrating containers, querying proprietary APIs, and purchasing computational workloads.

However, enabling an agent to transact in the digital economy currently introduces severe structural hazards:
* **The Treasury Custody Trap:** Giving an autonomous agent direct access to a cryptocurrency wallet or credit card exposes the user's entire balance to catastrophic loss through prompt injection attacks, model hallucinations, compromised plugins, or unbounded recursion.
* **The Micromanagement Bottleneck:** Requiring human approval for every micro-transaction negates the efficiency gains of autonomy, converting agents into high-frequency notification generators.
* **The Information Leakage Dilemma:** Transparent public blockchains force agents to publish their prompts, execution strategies, and counterparty pricing agreements in the clear, destroying commercial confidentiality and inviting front-running.

---

## 2. Why Autonomous Agents Need Economic Infrastructure

Autonomous agents require a specialized economic layer that decouples **intent** from **custody**. 

Just as operating systems use sandboxed virtual memory and capability-based security to prevent unprivileged software from corrupting host kernels, the autonomous agent economy requires **bounded economic sandboxes**:

```
Traditional Approach (Dangerous):
User ──► Hands Private Key / Credit Card ──► Agent ──► [Unconstrained Treasury Drain]

Pactra Approach (Bounded & Private):
User ──► TaskPolicy (Budget Ceiling + Capability Bitmask + Condition Commitment)
             │
             ▼
        [Compact Smart Contract Escrow on Midnight]
             │
             ▼
        Agent Proposes ──► Contract Authorizes ──► Provider Executes ──► Verifier Proves ──► Escrow Settles
```

Pactra operates on the foundational principle: **"Give an agent a goal and bounded economic authority — not your wallet."**

---

## 3. Pactra Architecture

Pactra is organized as a modular monorepo combining zero-knowledge Compact contracts, cryptographic policy engines, and a modern dApp interface:

```
agent-commerce-midnight/
├── contract/                          # Midnight Smart Contracts & Protocol Engine
│   ├── src/
│   │   ├── task_escrow.compact        # Compact smart contract (6 ZK circuits)
│   │   ├── pactra/                    # Core Economic Operating Layer
│   │   │   ├── policy.ts              # Capability bitmasks, TaskPolicy, OnChainPolicyBinding
│   │   │   ├── authority.ts           # AgentAuthorityManager & non-custodial tokens
│   │   │   ├── registry.ts            # Generalized Multi-Service Marketplace Registry
│   │   │   ├── procurement.ts         # Multi-service micro-procurement engine
│   │   │   ├── planner.ts             # Deterministic multi-action task planner
│   │   │   ├── verifier.ts            # Objective completion verification engine
│   │   │   ├── arbitration.ts         # M-of-N threshold arbitration & dispute board
│   │   │   ├── cryptoUtils.ts         # Synchronous universal SHA-256 (Node + Browser)
│   │   │   └── cityAdapter.ts         # Autonomous runtime node integration
│   │   ├── witnesses.ts               # Private state witness providers
│   │   ├── index.ts                   # Protocol package barrel exports
│   │   └── test/                      # Comprehensive test suites (60 contract tests)
│   │       ├── task-escrow.test.ts    # Level 1 escrow simulator tests
│   │       ├── pactra-level2.test.ts  # Level 2 policy & budget invariant tests
│   │       └── pactra-level3.test.ts  # Level 3 marketplace, bitmask, & arbitration tests
│   ├── vitest.config.ts
│   └── package.json
├── ui/                                # Production dApp Interface
│   ├── src/
│   │   ├── components/                # React 19 visual architecture
│   │   │   ├── Header.tsx             # Wallet connector and network status
│   │   │   ├── EscrowTimeline.tsx     # Contract state progression bar
│   │   │   ├── TaskDetailsCard.tsx    # Live contract & indexer state viewer
│   │   │   ├── RoleActionPanel.tsx    # Production transaction stepper & actions
│   │   │   ├── AgentAuthorityPanel.tsx# Agent planning, budget gauges, & procurement
│   │   │   ├── MarketplaceView.tsx    # Multi-service catalog across 5 capabilities
│   │   │   ├── ArbitrationPanel.tsx   # Visual M-of-N dispute voting console
│   │   │   └── PrivacyModelInspector.tsx # Visual private vs public state boundaries
│   │   ├── services/
│   │   │   ├── wallet.ts              # Deterministic Lace wallet state machine
│   │   │   ├── contractClient.ts      # Real Midnight Preprod client & transaction executor
│   │   │   ├── escrowService.ts       # Escrow protocol synchronization with indexer
│   │   │   └── pactraUiService.ts     # Unified protocol frontend coordinator
│   │   ├── test/
│   │   │   └── ui-services.test.ts    # 10 comprehensive UI service tests
│   │   ├── App.tsx                    # Main dApp layout & tabbed navigation
│   │   └── index.css                  # Cyberpunk dark mode glassmorphic design tokens
│   └── package.json
├── scripts/
│   ├── compile.js                     # Cross-platform Compact compiler runner
│   ├── deploy.ts                      # Midnight Preprod contract deployment script
│   └── check-security.js              # Static security and secret scanning quality gate
├── docs/
│   └── idea-submission.md             # Official Midnight challenge submission
└── .github/
    └── workflows/
        └── ci.yaml                    # Automated GitHub Actions CI pipeline
```

---

## 4. Security Model

The Pactra security model assumes that the **agent planner is completely untrusted**:
1. **Zero Key Custody:** The agent never receives or manages user private keys, seed phrases, or master credentials.
2. **Strict Escrow Sandboxing:** The maximum liability for any task is capped on-chain by the escrowed balance (`maxBudget`). An agent cannot touch or compromise funds remaining in the user's primary treasury.
3. **No Generic Transaction API:** The protocol strictly forbids generic transaction broadcasting methods (e.g., `sendTransaction(recipient, amount)`). Agent procurement requests must map to approved service providers and capability bitmasks.
4. **On-Chain Policy Binding:** Critical policy constraints are anchored cryptographically to the smart contract:
   * **`capabilityBits`**: An immutable bitmask restricting services to `COMPUTE` (0x01), `STORAGE` (0x02), `API_CALL` (0x04), `DEPLOYMENT` (0x08), and `DATA_PROCESSING` (0x10).
   * **`approvedProvidersRoot`**: Merkle root commitment of allowed provider identity commitments.
   * **`completionConditionCommitment`**: Hash commitment of exact verifiable completion criteria.
5. **Anti-Replay & Double-Spend Protection:** Every procurement execution and evidence hash is single-use. Replay attempts are rejected with `REPLAYED_EVIDENCE` errors.
6. **No Self-Declared Success:** The agent is mathematically prevented from declaring its own task completed. Settlement requires valid completion evidence matching the condition commitment or an M-of-N arbitration threshold verdict.

---

## 5. Privacy Model & Selective Disclosure

Pactra leverages Midnight's dual-state ledger architecture to preserve commercial confidentiality while maintaining public verifiability:

```
┌───────────────────────────────────────────────────────────┐
│                     PRIVATE (WITNESS)                     │
│  • User objective instructions & proprietary prompts       │
│  • Granular policy constraints & maximum reserve budget   │
│  • Agent planning execution graph & intermediate steps    │
│  • Sensitive procurement parameters & dataset payloads    │
│  • Provider execution evidence & logs                     │
└─────────────────────────────┬─────────────────────────────┘
                              │
                    ZK Proving Circuits
                              │
                              ▼
┌───────────────────────────────────────────────────────────┐
│                  OBSERVABLE LEDGER STATE                  │
│  • taskId Commitment (Bytes<32>)                          │
│  • Creator & Agent Identity Commitments (Bytes<32>)       │
│  • Task State Enum (CREATED, FUNDED, ACTIVE, etc.)        │
│  • Escrowed Balance & Settlement State                    │
│  • Objective Condition Commitment Hash (Bytes<32>)        │
│  • Verified Evidence Hash Commitment (Bytes<32>)          │
└───────────────────────────────────────────────────────────┘
```

**Selective Disclosure in Disputes:** When a dispute is raised, sensitive logs and evidence payloads are disclosed *only* to the designated arbitrators on the `ArbitrationBoard`, leaving the public ledger entirely shielded.

---

## 6. Procurement Lifecycle

The autonomous commerce loop executes across 10 deterministic stages:

```
1. USER OBJECTIVE       User provides task prompt and configures budget limits
       │
2. PRIVATE POLICY       Pactra compiles TaskPolicy and on-chain capability binding
       │
3. ESCROW DEPOSIT       Creator deposits bounded funds into TaskEscrow contract
       │
4. SERVICE DISCOVERY    Agent queries generalized marketplace registry
       │
5. QUOTE VERIFICATION   Provider returns quote; engine checks unit price <= maxPrice
       │
6. POLICY AUTH TOKEN    Authority manager issues task-scoped AuthorizedProcurementToken
       │
7. SERVICE EXECUTION    Provider executes workload within sandboxed environment
       │
8. EVIDENCE SUBMISSION  Provider signs execution evidence (hashes, duration, costs)
       │
9. VERIFICATION         CompletionVerifier compares evidence against condition root
       │
10. SETTLEMENT / REFUND Escrow releases funds to provider (settleTask) or reverts to user (refundTask)
```

---

## 7. Verification Model

Pactra differentiates between objective and subjective task verification:

### Objective Verification (`CompletionVerifier`)
For tasks with deterministic outcomes (e.g., cryptographic hash matching, verifiable computation, SLA timing), verification is performed automatically:
* `jobIdMatches`: Execution matches requested job envelope.
* `providerAuthorized`: Provider identity commitment matches policy allowlist.
* `withinCostBound`: Actual cost incurred does not exceed authorized quote.
* `resultMatchesCommitment`: Result payload hash matches `expectedResultCommitment`.
* `evidenceFormatValid`: Provider cryptographic signature is valid.

### Subjective Verification Fallback
If a task involves non-deterministic or qualitative outputs (e.g., code synthesis, creative design, research summaries), `isSubjectiveTask` is flagged as `true`. The protocol marks `requiresHumanSignoff = true` and routes resolution to external or human verifiers.

---

## 8. Multi-Party Dispute & Arbitration Model

When an execution fails, times out, or delivers corrupted output, Pactra activates the `ArbitrationBoard`:

* **Structured Arbitrator Registry:** Composed of automated oracle nodes and certified human domain arbitrators.
* **Threshold Voting:** Supports configurable M-of-N quorum (default: 2-of-3 threshold).
* **Deterministic Verdicts:**
  * `UPHOLD_SETTLEMENT`: Evidence verified; escrow released to service provider.
  * `REFUND_CREATOR`: Provider breached SLA or delivered invalid output; escrow returned to creator.
  * `SPLIT_PENALTY`: Partial dispute resolution; penalty assessed.
  * `TIMED_OUT_REFUND`: If the arbitration window expires without quorum, funds automatically revert to the task creator.

---

## 9. Midnight Network Integration

Pactra connects directly to Midnight Preprod without client-side mockups:

* **Compact Compiler Toolchain:** Contracts are compiled via Midnight's native compiler (`compact 0.23`) into zero-knowledge proving keys (`zkir`) and TypeScript runtime bindings.
* **Midnight Lace Connector:** Full integration with the official `window.midnight.mnLace` browser extension API, supporting unsealed transaction balancing and private witness state management.
* **Live GraphQL Indexer:** Live query integration with `https://indexer.preprod.midnight.network/api/v4/graphql` for real-time ledger synchronization and block height confirmation.
* **Deterministic Transaction Stepper:** The dApp enforces a strict transaction lifecycle:
  `READY` → `WALLET_REQUIRED` → `USER_SIGNATURE_REQUIRED` → `SUBMITTED` → `CONFIRMING` → `CONFIRMED` → `INDEXED`.

---

## 10. Local Development

### Prerequisites
* **Node.js**: `>= 20.x` (v24.x recommended)
* **npm**: `>= 10.x`
* **Midnight Compact Compiler**: Installed via native CLI or WSL Ubuntu (`compact --version`)
* **Browser Extension**: Midnight Lace Wallet configured for Preprod Testnet

### Installation
```bash
# Clone the repository
git clone https://github.com/kalpeshparashar/agent-commerce-midnight.git
cd agent-commerce-midnight

# Install workspace dependencies
npm install --prefix contract
npm install --prefix ui
```

### Build & Compilation
```bash
# Compile Compact smart contracts to ZK circuits
npm run compile:contract

# Typecheck entire TypeScript codebase
npm run typecheck

# Build production UI bundle
npm run build:ui
```

### Launch Development Server
```bash
npm run dev:ui
```
Navigate to `http://localhost:3000` to access the Pactra protocol dashboard.

---

## 11. Midnight Preprod Testnet Deployment

To deploy a live instance of the `TaskEscrow` contract on the Midnight Preprod testnet:

1. Launch the dApp: `npm run dev:ui`.
2. Connect your **Midnight Lace Wallet** to the **Preprod Testnet**.
3. Obtain testnet tokens (`tNight` and `DUST`) from the Nethermind faucet.
4. On the dashboard, select **👤 Task Creator (User)** and click **🚀 Deploy TaskEscrow to Midnight Preprod**.
5. Approve the deployment transaction fee in the Lace extension popup.
6. Once included in a block, the dApp records the contract address and synchronizes state via the Midnight GraphQL Indexer.

---

## 12. Testing Suite

Pactra features a test suite of **70 passing automated tests**:

```bash
# Run all contract, policy, marketplace, arbitration, and UI service tests
npm run test
```

### Breakdown of Test Suites
* **`contract/src/test/task-escrow.test.ts` (21 tests)**:
  * Complete lifecycle state transitions: `UNINITIALIZED` → `CREATED` → `FUNDED` → `ACTIVE` → `COMPLETION_PENDING` → `COMPLETED`.
  * Negative invariants: invalid state transitions, zero budget rejection, unauthorized agent acceptance, overspend prevention.
  * Refund workflows: creator reclaim after funding, active task refund, double-refund prevention.
* **`contract/src/test/pactra-level2.test.ts` (14 tests)**:
  * Capability policy checks and unauthorized capability rejections.
  * Per-transaction budget ceilings and cumulative budget exhaustion.
  * Expired task policy rejections and unapproved provider blocking.
  * Replayed evidence detection and objective condition mismatch handling.
  * Strict rejection of unauthorized wallet transfer attempts.
* **`contract/src/test/pactra-level3.test.ts` (25 tests)**:
  * All 5 capability categories: `COMPUTE`, `STORAGE`, `API_CALL`, `DEPLOYMENT`, `DATA_PROCESSING`.
  * Multi-service action graph planning and topological dependency ordering.
  * Provider revocation lifecycle (`ACTIVE` → `REVOKED`) and runtime blocking.
  * Provider quote tampering and price spike rejections.
  * Cryptographic capability bitmask validation (`CAPABILITY_BITS`).
  * Condition commitment root anchoring and verification.
  * Multi-party threshold arbitration: 2-of-3 quorum, split verdicts, unauthorized arbitrator rejection, and voting timeouts.
* **`ui/src/test/ui-services.test.ts` (10 tests)**:
  * Deterministic Lace wallet state machine transitions (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `FAILED`).
  * End-to-end UI protocol service planning, marketplace procurement, evidence verification, and arbitration voting.
  * Escrow service indexer synchronization and local state resets.

---

## 13. Threat Model & Attack Analysis

| Attack Vector | Attacker Objective | Pactra Defense Mechanism |
|---|---|---|
| **Prompt Injection / Jailbreak** | Manipulate agent into draining user treasury | Agent has **zero treasury keys**. Maximum possible expenditure is strictly bounded by `maxBudget` in escrow. |
| **Runaway Micro-Transactions** | Deplete user balance through thousands of rapid API requests | `maxSpendPerTransaction` caps individual costs; cumulative budget tracker halts agent upon exhaustion. |
| **Rogue Service Provider** | Claim payment without delivering computation | Escrow requires valid `ExecutionEvidence` signed by provider matching condition commitment; agent cannot self-settle. |
| **Provider Price Gouging** | Increase unit prices dynamically during active negotiation | `validateServiceQuote` enforces that quotes cannot exceed `maxPrice` registered in marketplace. |
| **Evidence Replay Attack** | Resubmit previous valid evidence to claim duplicate payment | `spentJobIds` and `spentEvidenceHashes` enforce single-use execution tokens. |
| **Corrupted / Subjective Output** | Provider delivers garbage data for subjective tasks | `ArbitrationBoard` requires M-of-N threshold consensus among independent oracle nodes and human experts. |
| **Contract Policy Tampering** | Off-chain planner attempts to modify spending limits or allowed providers | Policy commitment and capability bitmask are anchored cryptographically to the Midnight contract. |

---

## 14. Current Implemented Functionality vs Limitations

### Implemented Functionality (Level 3 Complete)
* [x] Official Midnight Compact contract (`task_escrow.compact`) with 6 compiled zero-knowledge circuits.
* [x] Generalized Multi-Service Marketplace supporting `COMPUTE`, `STORAGE`, `API_CALL`, `DEPLOYMENT`, and `DATA_PROCESSING`.
* [x] Dynamic service registry with pricing models, SLA terms, and active/revoked lifecycle states.
* [x] Cryptographic policy bindings: capability bitmasks, provider allowlist roots, condition roots.
* [x] Non-custodial agent authority manager with capability-based procurement tokens.
* [x] Multi-party threshold arbitration board (M-of-N consensus, timeout refunds).
* [x] Production transaction flow with deterministic state machine and visual stepper.
* [x] Midnight Lace wallet integration with unsealed balancing and indexer synchronization.
* [x] 70 comprehensive unit, integration, and UI service tests.
* [x] Automated GitHub Actions CI/CD with static security and secret scanning.

### Current Limitations & Research Areas
* **Deterministic Planner vs Autonomous LLM:** The current planner employs deterministic task templates. Replacing this with an autonomous LLM (e.g., Claude 3.7 or GPT-4o) requires connecting the existing `procurementEngine` to an agent tool-calling framework (e.g., LangChain / MCP). The security boundary is already designed to support this swap without alteration.
* **On-Chain Merkle Tree Verification in Compact:** While capability bitmasks are currently verified directly, full Merkle membership proofs for large provider allowlists (10,000+ providers) inside Compact circuits are planned for Level 4.
* **Off-Chain Proof Server Hosting:** For production headless agents, deploying a dedicated Midnight Proof Server daemon is recommended over in-browser proving for faster ZK-SNARK generation.

---

## 15. Roadmap

* **Level 1 (Completed):** Core TaskEscrow Compact contract primitive, simulator tests, and initial Lace wallet connector.
* **Level 2 (Completed):** Agent capability model, TaskPolicy, budget gauges, single-job micro-procurement, and privacy boundary inspector.
* **Level 3 (Completed — Current):** Generalized multi-service marketplace, cryptographic bitmasks, multi-party threshold arbitration, production transaction stepper, CI/CD quality gates, and 70 passing tests.
* **Level 4 (Future Research):**
  * Model Context Protocol (MCP) server exposing Pactra procurement tools directly to Claude, Cursor, and AutoGPT.
  * Multi-agent sub-delegation trees with recursive ZK budget allowances.
  * Native Midnight Proof Server integration for headless autonomous daemon execution.
  * DePIN marketplace cross-chain settlement bridges.

---

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
