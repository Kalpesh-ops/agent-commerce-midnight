# Pactra Level 5 Security Review & Threat Model

> **AUDIT CLASSIFICATION:** Internal Engineering Security Review (Preprod v0.5.0)  
> *Notice: This document reflects an internal security review conducted by the Pactra engineering team. It is not a third-party formal audit certification.*

---

## 1. Security Architecture & Core Invariant

The fundamental security principle of Pactra is:
> **"Give an agent a goal and bounded economic authority — not your wallet."**

In traditional crypto setups, developers frequently grant autonomous agents direct custody of private keys or unconstrained spending access to wallet treasuries. If an agent hallucinates, runs a malicious tool, or experiences prompt injection, the entire treasury is drained.

Pactra solves this by placing an immutable, non-custodial barrier between the agent and the blockchain:
```
USER (Holds private key in Lace wallet)
  │
  ├─ Signs Task Escrow deposit on Midnight
  │   (Locks maximum budget, e.g. 50 tDUST)
  │
  └─ Issues signed TaskPolicyEnvelope
       │
       ▼
AGENT (Holds ONLY bounded procurement authority)
  ├─ Cannot sign arbitrary transactions
  ├─ Cannot transfer funds to untrusted addresses
  ├─ Cannot exceed per-call or per-task limits
  │
  ▼
SERVICE PROVIDER (Delivers work)
  │
  ▼
VERIFIER / ESCROW (Settles upon valid cryptographic proof)
```

---

## 2. Component-by-Component Security Audit

### 2.1 Agent API (`PactraAgentClient`, `AgentAuthorityManager`)
- **Authority Scope**: Agents never hold a private key or signing key. Authority is represented as a structured authorization token (`DelegatedAuthorityToken`) bound to a single `taskId`, maximum spend ceiling, and service whitelist.
- **Enforcement**: Every procurement request validates the requested amount against the remaining budget. Attempts to exceed limits throw `PolicyViolationError` immediately.
- **Finding**: High resilience against agent prompt injection; an injected prompt instructing the agent to "send all funds to attacker" fails because the agent lacks any capability to execute arbitrary transfers.

### 2.2 Model Context Protocol (MCP) Adapter (`PactraMcpAdapter`)
- **Tool Surface**: Exposes bounded tools (`pactra_discover_services`, `pactra_request_procurement`, `pactra_check_budget`, `pactra_submit_evidence`).
- **No Treasury Tool**: Does NOT expose any tool for transferring funds, exporting keys, or modifying policies.
- **Input Validation**: All tool parameters are strictly validated with explicit schemas before processing.

### 2.3 Wallet Integration (`walletService.ts`, Lace)
- **Deterministic State Machine**: Rejects concurrent connection requests (`isConnecting` lock), avoiding race conditions.
- **No Secret Access**: Communication with Midnight Lace happens via the standard injected DApp connector (`window.midnight.lace`). Pactra never asks for or handles the user's seed phrase or private keys.
- **Signature Prompts**: Every escrow deposit or state transition requires explicit user approval in the Lace popup window.

### 2.4 Policy Enforcement & Cryptographic Binding
- **Dual Verification**: Policies are enforced both off-chain in the agent authority manager and on-chain via Blake2b cryptographic commitments (`policyCommitment`).
- **Tamper Resistance**: If an agent attempts to forge or alter its policy limits, the generated hash mismatches the on-chain escrow commitment, causing contract rejection.

### 2.5 Transaction Construction & Race Conditions
- **State Guards**: `RoleActionPanel.tsx` enforces `isProcessing` state guards to prevent double-clicks, duplicate transaction submissions, or state desynchronization during network latency.
- **Rejection Recovery**: User cancellation in Lace aborts the action without leaving the DApp in a corrupted state.

### 2.6 Evidence Submission & Verification
- **Evidence Schema**: Services must submit valid cryptographic evidence (SHA-256 result hash, artifact URI, execution signature) before escrow settlement is enabled.
- **Dispute Protection**: If a service fails to deliver valid evidence before the deadline, the client can initiate a refund or invoke threshold arbitration.

### 2.7 M-of-N Threshold Arbitration (`ArbitrationBoard`)
- **Quorum Rules**: Requires $M$ of $N$ authorized arbitrator signatures to resolve disputed escrows.
- **No Single Point of Failure**: Neither the user nor the provider can unilaterally resolve a contested escrow without reaching the designated arbitrator quorum.

### 2.8 Local Storage & Browser-Side Secrets
- **Storage Audit**: Browser `localStorage` is restricted to non-sensitive keys:
  - `pactra_onboarding_completed` (boolean)
  - `pactra_active_task_v1` (cached task ID and public status)
  - `pactra_telemetry_events_v1` (anonymized event names and timestamps)
  - `pactra_tester_feedback_v1` (local feedback reviews)
- **Zero Secrets**: Zero private keys, seed phrases, or wallet secrets are ever stored in `localStorage` or `sessionStorage`.

### 2.9 Privacy-Preserving Telemetry (`telemetryService.ts`)
- **Scrubbing Filter**: Automatically rejects and drops any event payload containing keys matching `/private|secret|seed|prompt|key/i` or values resembling 64-character private keys or hashes.
- **Aggregated Metrics**: Only records high-level operational milestones (`WALLET_CONNECTED`, `TASK_CREATED`, `PROCUREMENT_SUCCESS`).

### 2.10 Dependency Hygiene & Automated Scanner
- **Static Gate**: `npm run check:security` executes `scripts/check-security.js` across the entire codebase to detect:
  - Private key patterns
  - Mnemonic seed phrases
  - Direct wallet secret assignments
  - Prohibited agent treasury bypass methods
  - LocalStorage secret assignments
- **Current Status**: Passed with 0 violations.

---

## 3. Threat Model & Mitigations

| Threat | Attack Vector | Pactra Mitigation |
| :--- | :--- | :--- |
| **Agent Prompt Injection** | Malicious prompt instructs agent to drain wallet. | Agent has no wallet access or transfer capabilities; spend is capped at escrow deposit. |
| **Rogue Service Provider** | Provider claims payment without completing work. | Escrow holds funds until valid execution evidence is verified; dispute path available. |
| **Phishing / Malicious DApp** | Attacker clones UI to harvest seed phrases. | Pactra never prompts for seed phrases; user interacts exclusively with official Lace popup. |
| **Replay / Duplicate Attack** | Attacker replays transaction submission. | Nonce-backed Compact contract transactions and UI submit locks prevent re-execution. |
| **Indexer Outage / Stale State** | Delayed indexer sync shows outdated balance. | UI indicates synchronization state and prompts user to wait for confirmation. |
| **Telemetry Leaks** | Plaintext prompts or task goals captured in logs. | Telemetry filter strictly scrubs prompts and sensitive keys before recording. |

---

## 4. Residual Risks & Future Work (Level 6)
1. **Formal Third-Party Audit**: An external security audit by an accredited smart contract security firm should be conducted prior to mainnet launch.
2. **Formal Verification of Compact Contracts**: Mathematical proof of state transitions in `task_escrow.compact`.
3. **Decentralized Arbitrator Network**: Transition from designated Preprod arbitrator keys to a decentralized staking-backed oracle network.
