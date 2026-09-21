# Pactra: Privacy-First Economic Infrastructure for Bounded Autonomous Agents
## Official Midnight Challenge Idea & Problem Submission

---

### Executive Summary

**Project Name:** Pactra  
**Positioning:** Economic infrastructure for bounded autonomous agents  
**Network:** Midnight Network (Cardano Partner Chain)  
**Track / Theme:** Autonomous Agent Commerce, Privacy-Preserving Infrastructure, Zero-Knowledge Smart Contracts  

> **Core Proposition:**  
> Pactra lets autonomous AI agents discover services, procure digital resources, and settle micro-payments under private, user-defined economic policies without ever giving agents unrestricted custody of user funds or private keys.

---

### 1. The Core Problem: The Autonomous Agent Custody Trilemma

As LLMs and autonomous reasoning systems evolve into autonomous actors that browse the web, write code, run analyses, and manage infrastructure, they encounter a fundamental economic barrier: **they cannot pay for anything without creating catastrophic security vulnerabilities.**

Today, enabling an autonomous agent to transact forces users into an untenable trilemma:

1. **Unrestricted Treasury Access:** Give the agent a crypto wallet private key or credit card.  
   *Failure Mode:* Prompt injection attacks, semantic jailbreaks, model hallucination, or compromised counterparty APIs result in total treasury drain in seconds.
2. **Human-in-the-Loop Micro-Approvals:** Require a human signature for every compute cycle, storage byte, and API call.  
   *Failure Mode:* Destroys agent autonomy and real-time responsiveness, reducing the system to an impractical notification spam engine.
3. **Walled-Garden SaaS Credit Accounts:** Pre-fund proprietary centralized API brokers.  
   *Failure Mode:* Recreates centralized financial surveillance, leaks confidential business objectives, imposes arbitrary platform rent, and restricts agents from interacting with open market networks.

**The Root Cause:** Blockchains and web APIs have traditionally treated identity and financial authority as binary: an entity either holds the private key and has total authority, or holds no key and has zero authority.

---

### 2. The Solution: Bounded Economic Authority with Zero-Knowledge Policy Enforcement

Pactra introduces a third paradigm: **Delegated, Cryptographically Bounded Economic Authority.**

Instead of handing an agent a wallet, the user creates an immutable **TaskPolicy** anchored on the Midnight Network:
* **Bounded Operating Escrow:** Maximum cumulative task budget (e.g., 10 DUST) and per-transaction ceiling (e.g., 2 DUST).
* **Capability Restrictions:** Bitmask-enforced allowed operational scopes (`COMPUTE`, `STORAGE`, `API_CALL`, `DEPLOYMENT`, `DATA_PROCESSING`).
* **Approved Provider Allowlist:** Cryptographic root of approved provider identity commitments.
* **Temporal Expiration:** Hard block-height or timestamp deadlines after which unspent funds automatically revert.
* **Objective Completion Commitment:** Mathematical condition root specifying objective verifiable requirements for settlement.

The agent proposes. The policy authorizes. The service executes. The verifier proves. The Compact smart contract settles.

---

### 3. Why Midnight is Essential (Not Just "Another Blockchain")

Pactra cannot exist on transparent public blockchains like Ethereum or Solana without destroying the commercial viability of autonomous agents. Midnight's zero-knowledge programmable data protection is foundational to each layer of the protocol:

#### A. Private Agent Objectives & Proprietary Prompts
Autonomous agents carry proprietary prompts, proprietary trading strategies, private dataset locations, and commercial trade secrets. On transparent chains, publishing task objectives exposes trade secrets to front-running and competitor surveillance. Midnight allows agents to execute tasks where the prompt, strategy, and dataset references remain strictly in private witness state, with only the commitment hash (`Bytes<32>`) visible on-chain.

#### B. Private Spending Policies & Counterparty Confidentiality
If a procurement agent reveals its maximum willingness-to-pay or total budget on a public ledger, marketplace providers will immediately game quotes to extract the maximum fee. On Midnight, the agent's fine-grained budget thresholds, reserve limits, and negotiation ceilings remain private. The contract verifies zero-knowledge proofs that the spend satisfies policy limits without exposing what those limits are.

#### C. Selective Disclosure & Verifiable Settlements
Midnight's hybrid ledger allows Pactra to maintain private execution details while generating publicly auditable settlement records. The public ledger observes only the escrow state transitions (`CREATED` → `FUNDED` → `ACTIVE` → `COMPLETION_PENDING` → `COMPLETED`), while dispute resolution evidence and provider SLA attestations are selectively revealed only to designated arbitrators or verifiers when a contest arises.

#### D. Non-Custodial Agent Authority Model
Agents do not hold user private keys. The agent derives isolated, task-scoped authorization proofs that can only satisfy specific circuit constraints within the Midnight Compact contract runtime. Even if the agent model is entirely compromised by a prompt injection attack, the adversary cannot drain the user's treasury beyond the locked task escrow and approved capabilities.

---

### 4. Pactra Protocol Architecture

```
                                  USER (CREATOR)
                                        │
                 1. Defines Objective & Private TaskPolicy
                                        │
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────┐
    │                        PACTRA ON-CHAIN BOUNDARY                        │
    │                                                                        │
    │  Compact Smart Contract (`task_escrow.compact`)                        │
    │  • Public State: taskId, creatorCommitment, agentCommitment,           │
    │                  escrowedAmount, taskState, settlementState            │
    │  • Private State (Witnesses): policy parameters, spending limits,      │
    │                               condition specifications                 │
    │  • Cryptographic Anchors: capabilityBits, approvedProvidersRoot,       │
    │                           completionConditionCommitment                │
    └────────────────────────────────────────────────────────────────────────┘
                                        ▲
                       2. Authorizes    │   6. Settles via ZK Proof
                       Bounded Escrow   │      (settleTask / refundTask)
                                        │
                                        ▼
                               AUTONOMOUS AGENT
                                        │
                        3. Multi-Service Planning & Discovery
                           (Compute, Storage, API, Deploy, DataProc)
                                        │
                                        ▼
                            AUTHORIZED SERVICE PROVIDER
                                        │
                                4. Executes Service
                                5. Produces ExecutionEvidence
                                        │
                                        ▼
                      INDEPENDENT VERIFICATION / ARBITRATION
                      • Objective Tasks: Cryptographic output matching
                      • Subjective Tasks: M-of-N Threshold Arbitration Board
```

---

### 5. Generalized Multi-Service Marketplace

Pactra expands autonomous agent economic capabilities beyond single compute jobs into five primary service categories:

| Category | Typical Agent Workload | Pricing Model | Verification Method |
|---|---|---|---|
| **COMPUTE** | Sandboxed container execution, LLM fine-tuning, ML inference | Hourly / Per-job | Enclave execution evidence & input/output hashes |
| **STORAGE** | Model artifact persistence, encrypted vector memory, audit logs | Fixed capacity | Merkle hash chain & retrieval proofs |
| **API_CALL** | Oracle data retrieval, web scraping, external payment triggers | Per-call | Cryptographic provider signature attestation |
| **DEPLOYMENT** | MicroVM staging, webhook endpoint hosting, edge deployment | Fixed / Subscription | Multi-signature health attestations |
| **DATA_PROCESSING** | Tokenization, tabular ETL, vector embedding generation | Usage-tiered | Deterministic result commitment verification |

---

### 6. Verification and Dispute Architecture

A foundational rule of Pactra is: **The agent NEVER declares its own success.**

1. **Deterministic Objective Verification:**  
   When an agent procures a service with objective completion criteria (e.g., producing a file with a known hash or completing an ETL transformation within bounds), the `CompletionVerifier` cryptographically validates that the output hash and cost match the contract's condition commitment.
2. **Multi-Party Threshold Arbitration for Subjective Tasks:**  
   When tasks contain subjective or qualitative deliverables (e.g., "design a UI layout" or "research market trends"), Pactra routes dispute resolution to an M-of-N `ArbitrationBoard`:
   * Combines automated oracle nodes with human domain experts.
   * Enforces cryptographic quorum (e.g., 2-of-3 threshold).
   * Supports structured verdicts: `UPHOLD_SETTLEMENT`, `REFUND_CREATOR`, `SPLIT_PENALTY`, or `TIMED_OUT_REFUND`.

---

### 7. Current Implementation Status (Level 6 Eclipse Complete)

Pactra is an active, fully functional protocol running on Midnight Preprod with zero simulation mockups in production paths:

* **Compact Smart Contract & Audit Readiness:** Fully compiled with the official Midnight compiler across 6 ZK circuits (`createTask`, `fundTask`, `acceptTask`, `submitCompletion`, `settleTask`, `refundTask`). Verified against 10 formal security and balance invariants in `docs/audit-package.md`.
* **Autonomous Headless Agent Runtime:** Standalone server-side agent execution machine (`AutonomousAgentRuntime`) and non-custodial `CapabilityBroker` supporting 13 deterministic lifecycle states, exponential backoff, and deadline aborts.
* **Decentralized Arbitration & Staking:** 2-of-3 threshold consensus dispute engine with 6 arbitrator lifecycle states, evidence commitments, and automatic stake slashing for contradictory double votes.
* **Midnight Proof Server Adapter:** Zero-leakage, typed infrastructure adapter with active latency health checks and an explicit `NOT_CONFIGURED` fail-safe.
* **Agent-to-Agent Swarm Economy:** Multi-agent coordination tree (`PactraSwarmCoordinator`) enabling hierarchical budget and capability delegation trees.
* **Strict Multi-Network Isolation:** Separate environments for `LOCAL`, `PREPROD`, and `MAINNET` enforced by hard `NetworkGuards` preventing silent fallbacks.
* **Reproducible Mainnet Deployment:** 11-stage verified pipeline, hash checks, and rollback procedures (`docs/mainnet-deployment.md`).
* **Midnight Preprod Integration:** Connected to the Midnight Preprod testnet via the official Midnight Lace wallet connector (`window.midnight.mnLace`) and the live GraphQL Indexer (`https://indexer.preprod.midnight.network/api/v4/graphql`).
* **Model Context Protocol (MCP) Adapter:** Extended MCP tool suite (including `pactra_request_dispute`) allowing Claude, Cursor, and LLM runtimes to procure resources under cryptographic constraints without private key custody.
* **Production Health Diagnostics:** Real-time system health monitor (`ProductionHealthMonitor`) and UI console (`SystemHealthPanel.tsx`).
* **Test Coverage:** **164 unit, integration, and chaos failure tests** passing across 17 test suites with zero regressions.
* **Automated CI/CD:** GitHub Actions workflow with strict automated quality gates enforcing typechecking, contract compilation, test suites, and secret scanning (`scripts/check-security.js`).


---

### 8. Target Audience & Ecosystem Impact

* **AI Agent Framework Developers (LangChain, AutoGPT, CrewAI, Eliza):** Provides an off-the-shelf, non-custodial economic runtime so developer agents can pay for compute and tools without custody risks.
* **DePIN & Infrastructure Providers (Akash, Filecoin, decentralized RPCs):** Enables decentralized providers to register as authorized Pactra services and receive programmable payments from autonomous agents.
* **Enterprise & Institutional Users:** Unlocks autonomous agent workflows in compliance-sensitive environments where regulatory frameworks prohibit giving AI models direct wallet or bank access.

---

### 9. Conclusion

Autonomous AI agents will become the largest consumer class of digital web services within the decade. Without privacy-preserving, bounded economic infrastructure, this economy will be stunted by security exploits and corporate surveillance.

Pactra harnesses the Midnight Network to give agents what they actually need: **a goal and bounded economic authority — not your wallet.**
