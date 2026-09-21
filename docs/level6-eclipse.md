# Pactra — Level 6: Eclipse Specification

> **Milestone**: Level 6 — Eclipse: Mainnet Hardening & Autonomous Swarm Economy  
> **Protocol Version**: `0.6.0-eclipse`  
> **Core Thesis**: *Give an agent a goal and bounded economic authority — not your wallet.*  
> **State**: Fully Implemented & Tested (164 Tests Passing Across 17 Suites)

---

## 1. Executive Summary

Level 6 transforms Pactra from a single-agent interactive dApp into a hardened, autonomous, multi-agent economic protocol ready for formal third-party audit and reproducible Mainnet deployment.

Crucially, **no users, mainnet transactions, fake proofs, or audit certifications are fabricated.** All components maintain strict boundaries between what is live on Midnight Preprod and what is prepared, isolated, and tested for future Mainnet launch.

---

## 2. Core Architectural Pillars of Level 6

### Pillar A: Mainnet Security Hardening & Audit Readiness
- **Audit Readiness Package**: Documented in `docs/audit-package.md`, including full circuit specifications, state transitions, privacy assumptions, and threat models.
- **Formal Invariant Verification**: 10 formal invariants codified and tested in `contract/src/test/pactra-invariants.test.ts`:
  1. Funds cannot settle twice.
  2. Refund and settlement cannot both succeed.
  3. Unauthorized actors cannot mutate protected task state.
  4. Agent authority cannot exceed task policy.
  5. Maximum task budget cannot be exceeded.
  6. Expired tasks cannot execute prohibited transitions.
  7. Invalid completion evidence cannot settle escrow.
  8. Disputed tasks cannot bypass arbitration.
  9. Arbitration decisions cannot be replayed or duplicated.
  10. Sequence numbers prevent stale state transitions.

### Pillar B: Autonomous Headless Agent Runtime
- **Location**: `contract/src/pactra/runtime/`
- **Zero Wallet Access**: The runtime never receives private keys, seed phrases, or generic transfer capabilities.
- **Capability Broker**:
  ```text
  Agent Runtime
       |
       v
  Capability Broker (Validates Policy Envelope & Scope)
       |
       +--> COMPUTE
       +--> STORAGE
       +--> API_CALL
       +--> DEPLOYMENT
       +--> DATA_PROCESSING
       |
       v
  Pactra Policy / Authorization
       |
       v
  Midnight Transaction Layer (ZK Proof + Ledger)
  ```
- **13-State Deterministic Lifecycle**:
  `RUNNING` → `WAITING_FOR_QUOTE` → `WAITING_FOR_AUTHORIZATION` → `PROCUREMENT_PENDING` → `EXECUTING` → `WAITING_FOR_PROOF` → `WAITING_FOR_VERIFICATION` → `DISPUTED` → `RETRYING` → `EXPIRED` → `COMPLETED` → `REFUNDED` → `ABORTED`.
- **Safe Failure Handling**: Implements exponential backoff, configurable retry limits, deadline enforcement, and abort-to-refund deterministic paths.

### Pillar C: Midnight Proof Server Integration
- **Typed Adapter**: `MidnightProofServerAdapter` (`contract/src/pactra/proof/proofServerAdapter.ts`).
- **No Faking Policy**: If proof server endpoints are not configured, the adapter transitions to an explicit `NOT_CONFIGURED` state with typed error codes. No simulated or mock proofs are ever presented as real.
- **Health Checks & Circuit Proving**: Features active latency checks, configurable timeout backoff, and circuit payload serialization without secret leakage.

### Pillar D: Decentralized Arbitration & Staking/Slashing
- **Architecture**:
  ```text
  Dispute Registered
         |
         v
  Arbitration Request (Stake Lock Active)
         |
         v
  Eligible Arbitrators (Minimum Stake Verified)
         |
         v
  Evidence Review & Vote Commitment
         |
         v
  2-of-3 Threshold Consensus Reached
         |
         +--> RELEASE (Vendor Paid)
         +--> REFUND (User Returned)
         |
  Slashing Check (Contradictory / Dishonest Votes Slashed)
  ```
- **Arbitrator Lifecycle**: `REGISTERED` → `ACTIVE` → `DISPUTED` → `SLASHED` → `WITHDRAWING` → `WITHDRAWN`.
- **Slashing Rules**: Arbitrators that submit contradictory double votes on the same dispute are slashed 100% of their stake, with funds redirected to a penalty pool.
- **Withdrawal Delays**: Unbonding requires an explicit timelock to prevent hit-and-run dispute manipulation.

### Pillar E: Strict Multi-Network Separation
- **Environments**: `LOCAL`, `PREPROD`, `MAINNET`.
- **Zero Silent Fallback**: Mainnet configurations throw explicit errors if connected to Preprod or Local endpoints.
- **Network Guards**: Runtime validators check network ID, contract address formats, indexer URLs, and proof server schemas before transaction generation.
- **Visual Network Identification**: UI displays dynamic, colored status indicators distinguishing Mainnet (`#ef4444` Crimson Alert) from Preprod (`#3b82f6` Blue Verified) and Local (`#f59e0b` Amber).

### Pillar F: Multi-Agent Swarm Economy
- **Swarm Coordinator**: `PactraSwarmCoordinator` (`contract/src/pactra/swarm/swarmCoordinator.ts`).
- **Bounded Sub-Delegation**:
  ```text
  User Policy (Total Budget: 10,000,000 DUST)
         |
         v
  Planner Agent
         |
         v
  Procurement Agent (Sub-envelope: Max 4,000,000 DUST)
         |
         +--> Compute Agent (Quote: 2,500,000 DUST)
         +--> Storage Agent (Quote: 800,000 DUST)
         |
         v
  Swarm Verifier -> Escrow Settlement
  ```
- Any child task that requests capabilities outside the parent's allowed categories or exceeds sub-budget is rejected immediately.

### Pillar G: MCP Autonomous Tool Suite
Extended MCP server capabilities with 6 strictly bounded tools:
1. `discover_services`: Search registered providers by category and budget.
2. `request_quote`: Solicit bounded service pricing.
3. `request_procurement`: Submit authorization token for escrow locking.
4. `submit_evidence`: Submit cryptographic execution hashes.
5. `get_task_status`: Query task escrow lifecycle on ledger.
6. `pactra_request_dispute`: Escalate stalled or defective task executions to the decentralized arbitration board.

### Pillar H: Production Health Layer
- **System Health Monitor**: `ProductionHealthMonitor` (`contract/src/pactra/health/healthMonitor.ts`).
- **Diagnostic UI**: `SystemHealthPanel` (`ui/src/components/SystemHealthPanel.tsx`).
- Tracks wallet, indexer, contract availability, proof server latency, and aggregate operational metrics without logging sensitive data, prompts, or keys.

---

## 3. Privacy vs Public Ledger Model

| Data Dimension | Privacy Level | Mechanism / Ledger Location |
|---|---|---|
| User Goal & Task Intent | **Private** | Kept client-side / confidential in agent context |
| Full Task Specification & Preimage | **Private** | Salted SHA-256 hash committed to Compact contract |
| Agent Prompt Context | **Private** | Headless agent runtime memory; never logged |
| Bounded Spending Limit | **Selectively Disclosed** | Encrypted in ZK witness; proven against balance |
| Capability Scope & Expiry | **Selectively Disclosed** | Verified by zero-knowledge circuit |
| Escrow State Root | **Public** | Midnight on-chain ledger commitment |
| Final Settlement / Refund | **Public** | Midnight on-chain consensus state transition |

---

## 4. Verification & Testing Matrix

Pactra Level 6 features **164 automated tests** across 17 test suites:
- `contract/src/test/pactra-invariants.test.ts` (10 tests)
- `contract/src/test/pactra-runtime.test.ts` (8 tests)
- `contract/src/test/pactra-proof-adapter.test.ts` (5 tests)
- `contract/src/test/pactra-arbitration-staking.test.ts` (6 tests)
- `contract/src/test/pactra-network-isolation.test.ts` (8 tests)
- `contract/src/test/pactra-swarm.test.ts` (5 tests)
- `contract/src/test/pactra-mcp-level6.test.ts` (5 tests)
- `contract/src/test/pactra-chaos-failure.test.ts` (6 tests)
- Plus all 111 baseline tests from Levels 1–5 preserved with **zero regressions**.

---

## 5. Truthful Deployment & Activity Status

1. **Preprod**: Fully deployed at address `02005470876fe6a506161494553205a28bf2c37db4517af850ec63d76e4695029a`.
2. **Mainnet**: Architecture, deployment pipeline, network guards, and security gates are 100% written and verified. **Mainnet has not been deployed** pending external security audit certification and Midnight Mainnet network genesis.
3. **External Users**: Truthfully reported as 0 external testers. No simulated testers or fabricated activity.
