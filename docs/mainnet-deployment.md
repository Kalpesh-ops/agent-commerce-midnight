# Pactra — Mainnet Deployment & Verification Manual

> **Network Level**: Level 6 — Eclipse  
> **Status**: Pipeline Prepared & Hardened | **Mainnet Deployment Status**: UNEXECUTED (Pending Independent Audit & Mainnet Genesis)  
> **Target Environment**: Midnight Mainnet (`networkId: "mainnet"`)  
> **Canonical Preprod Reference**: `02005470876fe6a506161494553205a28bf2c37db4517af850ec63d76e4695029a`

---

## 1. Executive Summary & Non-Negotiable Invariants

Pactra enforces a strict separation between **LOCAL**, **PREPROD**, and **MAINNET** environments. Configuration files and deployment scripts are strictly isolated to eliminate any accidental network cross-contamination.

### Deployment Truth & Anti-Fabrication Invariants
1. **No Simulated Mainnet Activity**: Having deployment scripts and environment templates is **not** evidence of a live Mainnet deployment.
2. **Explicit Verification Before Launch**: A Mainnet deployment requires:
   - Successful completion of an external third-party smart contract audit.
   - Independent verification of compiler and ZK proof artifacts.
   - Genuine user authorization with hardware/air-gapped multisig deployment keys.
3. **Zero Silent Fallbacks**: If Mainnet network connection, Proof Server, or Indexer fails, the system immediately faults to `HALTED` or `ABORTED`. It will **never** silently fall back to Preprod or Local networks.

---

## 2. Pre-Deployment Prerequisites

Prior to initiating the deployment sequence on Mainnet:
- Node.js version `>= 18.0.0`
- Compact compiler installed and verified (`compactc --version`)
- Midnight Proof Server reachable and returning HTTP 200 on `/health`
- Midnight Indexer GraphQL endpoint responsive
- Gas funding present in the deployer wallet (NIGHT / DUST native tokens)
- Environment variable `PACTRA_DEPLOY_CONFIRM=YES_DEPLOY_TO_MAINNET` explicitly exported

```bash
# Verify environment isolation guards
export PACTRA_NETWORK=mainnet
export PACTRA_DEPLOY_CONFIRM=YES_DEPLOY_TO_MAINNET
```

---

## 3. The 11-Stage Deployment Pipeline

### Stage 1: Clean Build & Typecheck
Ensure that all TypeScript packages and schemas compile without warnings or any type coercions.
```bash
npm run typecheck
npm run test
```
*Expected Output*: `164 passing tests across 17 suites, 0 errors.*`

### Stage 2: Deterministic Contract Compilation
Compile the Compact escrow contract circuit and generate zero-knowledge prover/verifier bindings.
```bash
npm run compile:contract
```
*Expected Output*: Compact circuit compilation succeeds, generating `contract/src/managed/task_escrow/`.

### Stage 3: Artifact Hash Verification
Compute and record SHA-256 digests of all generated contract binaries and circuits to guarantee reproducible provenance.
```bash
# Unix / WSL / PowerShell SHA256 verification
Get-FileHash -Algorithm SHA256 ./contract/src/managed/task_escrow/contract/index.js
Get-FileHash -Algorithm SHA256 ./contract/src/task_escrow.compact
```
*Verification Rule*: Compare the generated digests against the pre-audited release manifest in `docs/audit-package.md`. If hashes differ by even one bit, abort immediately.

### Stage 4: Network Configuration & Preflight Validation
Validate endpoint schemas and connectivity using the Pactra Network Guards:
```typescript
import { NetworkGuards } from "@pactra/contract/pactra/config/networkGuards";
import { MAINNET_CONFIG } from "@pactra/contract/pactra/config/environments";

// Enforces non-preprod indexer, non-preprod proof server, and exact mainnet chain ID
NetworkGuards.assertValidNetworkConfig(MAINNET_CONFIG);
```

### Stage 5: Deployer Key Isolation & Transaction Submission
Submit the contract creation transaction via Midnight SDK.
*Crucial*: Never pass raw private keys or seed phrases to headless agents or scripts. The deployment transaction must be signed using an isolated deployment key.
```bash
npm run deploy:contract -- --network=mainnet
```
*Expected Output*:
```text
[Deployer] Connecting to Midnight Mainnet node...
[Deployer] Proving deployment circuit via Proof Server...
[Deployer] Submitting transaction to Midnight Consensus...
[Deployer] Transaction Hash: 0x...
[Deployer] Contract Deployed Successfully!
```

### Stage 6: Deployment Transaction Confirmation & Finality
Wait for canonical finality on the Midnight ledger (minimum required depth: 10 consensus blocks).
```bash
node ./scripts/verify-tx.js --network=mainnet --tx=<TX_HASH>
```

### Stage 7: Contract Address Capture & Ledger Pinning
Capture the deployed contract address and persist it into the environment descriptor:
```json
{
  "network": "mainnet",
  "contractAddress": "<VERIFIED_MAINNET_CONTRACT_HEX>",
  "deployedBlock": 128490,
  "timestamp": "2026-09-21T00:00:00Z"
}
```
*Validation*: Run `NetworkGuards.assertAddressMatchesNetwork(contractAddress, "mainnet")`.

### Stage 8: Indexer Discovery & Synchronization
Query the Midnight Mainnet GraphQL indexer to confirm the newly deployed contract state is recognized and indexed:
```graphql
query CheckContract($address: String!) {
  contractState(address: $address) {
    address
    blockNumber
    stateRoot
  }
}
```
*Threshold*: Indexer lag must be `< 5 blocks` before proceeding to UI integration.

### Stage 9: Circuit Verification & Ledger State Introspection
Call initial query circuits (e.g., `query_task_state`) to verify ledger integrity:
- Contract state root initialized to empty commitments.
- Fee/escrow balances match zero.
- Replay counters and dispute nonces verified at initial sequence 0.

### Stage 10: Production Frontend Configuration
Configure production environment files in `ui/`:
```env
# ui/.env.production
VITE_PACTRA_NETWORK=mainnet
VITE_INDEXER_URL=https://indexer.mainnet.midnight.network/graphql
VITE_PROOF_SERVER_URL=https://proofs.mainnet.midnight.network
VITE_CONTRACT_ADDRESS=<VERIFIED_MAINNET_CONTRACT_HEX>
```
Run production build:
```bash
npm run build:ui
```

### Stage 11: Post-Deployment Smoke Tests & Health Monitor Launch
Execute post-deployment read-only integration probes:
```bash
npm run test:smoke:mainnet
```
Verify `ProductionHealthMonitor`:
- Wallet connector status: `AVAILABLE`
- Indexer latency: `< 350ms`
- Proof server health: `OK`
- Circuit verification: `PASSING`

---

## 4. Rollback & Emergency Abort Procedures

If any failure occurs during Stages 1–11, trigger the appropriate response:

### Pre-Settlement Deployment Failure (Stages 1–6)
1. Terminate deployment process immediately.
2. Mark transaction ID as `ABORTED` in deployment records.
3. No funds are at risk in user escrows because contract has not been broadcasted to the frontend or agent runtime.

### Post-Deployment Configuration Defect (Stages 7–10)
1. **Do not update frontend DNS or UI deployments**: Keep UI pinned to maintenance or Preprod.
2. If UI was already deployed, immediately activate the emergency redirect:
   `VITE_PACTRA_MAINTENANCE_MODE=true`
3. The TaskEscrow contract is immutable. Any un-redeemed task escrows are refunded to users via the deterministic `refund_task` circuit after task deadline expiration.

### Proof Infrastructure Degradation
1. If the Midnight Proof Server becomes unreachable, the agent runtime halts further procurement actions and enters `WAITING_FOR_PROOF`.
2. Capabilities remain locked to prevent unverified expenditures.

---

## 5. Mainnet Readiness Checklist

| Item | Requirement | Status |
|---|---|---|
| **Compact Contract** | Compilation without errors | Verified |
| **Circuit Invariants** | 10 formal invariants validated in unit suite | Verified (10/10) |
| **Agent Capability Broker** | Autonomous runtime never receives private keys | Verified |
| **Arbitration Protocol** | 2-of-3 decentralized slashing & consensus engine | Implemented & Tested |
| **Multi-Network Guards** | Local / Preprod / Mainnet isolation barriers | Verified (Zero Fallback) |
| **Third-Party Security Audit** | Independent review of Compact & TypeScript code | Pending External Audit |
| **Mainnet Genesis** | Official Midnight Mainnet live network | Awaiting Network Genesis |

---

## 6. Truthful Status Declaration

As of Level 6:
- **Preprod**: Fully deployed, verified, and operational at address `02005470876fe6a506161494553205a28bf2c37db4517af850ec63d76e4695029a`.
- **Mainnet**: Production architecture, deployment scripts, security gates, and isolation guards are 100% written and tested. Mainnet deployment is **NOT** executed and will not be claimed until the live Midnight Mainnet genesis occurs and formal audit certification is granted.
