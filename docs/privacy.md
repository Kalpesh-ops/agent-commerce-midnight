# Pactra Privacy Architecture & State Boundary Model

> **Central Architectural Principle:**
> *"Give an agent a goal and bounded economic authority — not your wallet."*

Pactra provides a privacy-preserving economic operating system for autonomous AI agents on the **Midnight Network**. This document explicitly defines what data is shielded, what data is observable, what cryptographic guarantees Midnight's zero-knowledge circuits provide, and what remains application-layer privacy.

---

## 1. The Core Privacy Problem in Agentic Commerce

In traditional Web3 and API architectures, autonomous agents face a dangerous dilemma:
1. **Unrestricted Key Custody:** The agent is given access to a hot wallet or private key. Any model failure, prompt injection, or compromised dependency can drain the user's entire balance.
2. **Total Public Exposure:** Every prompt, instruction, compute payload, negotiation strategy, and intermediate dataset is published in plaintext to a public mempool and blockchain explorer.

Pactra solves both problems simultaneously:
- **Economic Boundedness:** The agent operates under a cryptographically bound `TaskPolicy`, receiving only authorized micro-procurement tokens rather than private keys.
- **Dual-State Privacy Separation:** All sensitive intent, operational rules, and confidential execution data remain shielded, while verifiable commitments anchor the economic guarantees on-chain.

---

## 2. The Privacy Boundary Matrix

Pactra strictly distinguishes between what is **Shielded / Off-Chain Private** and what is **Public / Observable on Midnight Ledger**.

| Dimension | Shielded / Private Witness | Public / Observable Ledger |
| :--- | :--- | :--- |
| **Task Definition** | Detailed objective plaintext, prompt parameters, internal execution reasoning, training weights, source datasets. | `taskId` (UUID/hash), block height, task creation status (`CREATED`). |
| **Policy & Authority** | Approved capability whitelist details, per-transaction spending limits, discretionary rules, salt preimages. | Cryptographic Policy Commitment (`0x...`), Max Total Budget cap, Expiration timestamp. |
| **Agent Identity & Key** | User wallet private spending key, seed phrases, secret witnessing preimages. **Never exposed to agent or network.** | Coin Public Key (`coinPublicKey`), Authorized capability token identifier. |
| **Service Procurement** | Request payloads, model hyperparameters, proprietary input matrices, private API keys. | Provider commitment ID, capability category (`COMPUTE`), locked escrow balance. |
| **Evidence & Result** | Raw compute memory execution trace, intermediate neural activations, enclave attestation secret. | Execution Attestation hash, Output commitment hash ($H(Result, Salt)$), verification status. |
| **Arbitration & Settlement** | Private disagreement negotiation messages, confidential commercial terms. | Public dispute registration, 2-of-3 arbitrator signed verdicts, final escrow state (`COMPLETED` or `REFUNDED`). |

---

## 3. What Midnight Protects vs. Application-Layer Privacy

To maintain complete architectural integrity, Pactra does **not** make false claims that all application data is magically shielded by ZK. We clearly document the exact separation of responsibilities:

```
+-------------------------------------------------------------------------+
|                         APPLICATION LAYER PRIVACY                        |
|                                                                         |
|  - Local Agent Strategy & Prompting (Local LLM / Sandboxed Agent Runtime)|
|  - Off-Chain Policy Preimages (Browser LocalStorage / Secure Enclave)   |
|  - Confidential Workload Execution (Hardware TEE / SGX / Nitro Enclave)  |
|  - P2P Micro-Service Negotiated Parameters (Encrypted Transport)       |
+-------------------------------------------------------------------------+
                                    |
                                    v  (Poseidon / SHA-256 Commitments & Proofs)
+-------------------------------------------------------------------------+
|                        MIDNIGHT NETWORK ZK LAYER                        |
|                                                                         |
|  - Compact Zero-Knowledge Smart Contract (`TaskEscrow.compact`)          |
|  - Shielded DUST Coin State & Balance Transfers                         |
|  - Zero-Knowledge Proof Verification of Authorized Transitions          |
|  - On-Chain State Commitments (Ledger never sees witness preimages)      |
|  - Verifier-Enforced State Machine Invariants                           |
+-------------------------------------------------------------------------+
```

### Midnight Zero-Knowledge Guarantees
1. **Confidential Token Value Transfers:** DUST coin inputs, outputs, and ownership nullifiers are cryptographically blinded using Midnight's ZK-SNARK proving system. Observers cannot trace token movements between parties.
2. **ZK Witness Execution in Compact:** The Compact contract executes transitions (such as verifying that a settlement caller matches the authorized creator or agent) inside a private proof circuit before recording public commitments to the Midnight ledger.
3. **Immutability of Committed Constraints:** Once a commitment $H(\text{Policy}, \text{Salt})$ is written to the ledger, the contract enforces that no state transition can contradict the committed parameters.

### Application-Layer Guarantees
1. **Local Preimage Secrecy:** Detailed policy JSONs and task objectives are held client-side in the user's browser or local agent workspace. They are never broadcast over the network.
2. **Hardware Confidential Computing (TEE):** When interacting with `COMPUTE` services (e.g. `srv_compute_alpha`), raw data processing occurs inside Intel SGX or AWS Nitro secure enclaves. The provider's host OS cannot inspect execution memory.
3. **Deterministic Objective Verification:** The `CompletionVerifier` evaluates whether the cryptographic evidence matches the expected condition commitment off-chain before triggering the on-chain settlement release.

---

## 4. Cryptographic Policy Commitment Construction

The policy commitment anchors all agent permissions without leaking plaintext rules:

$$\text{PolicyCommitment} = \text{SHA-256}\Big(\text{taskId} \parallel \text{maxSpendPerTransaction} \parallel \text{maxTotalBudget} \parallel \text{capabilities} \parallel \text{salt}\Big)$$

### Mathematical Invariants
1. **Hiding Property:** Given only $\text{PolicyCommitment}$, it is computationally infeasible for an adversary to deduce the allowed capabilities, spending limits, or underlying task objective.
2. **Binding Property:** Once committed, the agent cannot alter its budget limit from 3 DUST to 100 DUST without causing an immediate hash mismatch.
3. **Zero-Knowledge Witnessing:** When the agent requests micro-procurements, the policy engine verifies validity by checking that the request satisfies the committed parameters without having to publish the full policy to the public chain.

---

## 5. Live Interactive Demonstration

Developers and evaluators can verify these privacy boundaries interactively in the Pactra DApp:
1. Navigate to the **"🛡️ Privacy & State Boundaries"** tab.
2. Observe the side-by-side **Shielded vs. Observable** matrix.
3. Experiment with the **Interactive Commitment Simulator**:
   - Change the private Task Objective from *"Confidential Market Sentiment Analysis"* to *"Classified DNA Sequence Alignment"*.
   - Notice that the derived **Policy Commitment** changes deterministically, but the **Public Ledger State** requires zero exposure of the sensitive plaintext objective.
4. Verify that the agent runtime operates entirely within capability tokens and has **zero access to wallet private keys or raw signing credentials**.
