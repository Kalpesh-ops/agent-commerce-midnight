# Pactra External Tester Guide (Midnight Preprod)

> **NETWORK NOTICE:** This application runs on **MIDNIGHT PREPROD / TESTNET**.
> Testnet tokens (tDUST) have zero real-world monetary value.
> **SAFETY RULE:** Always use a dedicated test wallet. Never import production seed phrases or provide private keys. The Pactra protocol grants agents bounded economic authority over escrow funds—never unrestricted wallet access.

---

## Overview

Welcome to the **Pactra External Testing Program** (Level 5: Full Moon). Pactra provides a privacy-preserving economic operating layer for autonomous AI agents on the Midnight Network.

As a tester, you will test the primary user journey:
```
CONNECT LACE → CREATE TASK → SET BOUNDED POLICY → AUTHORIZE AGENT 
  → DISCOVER COMPUTE → REQUEST PROCUREMENT → ESCROW → VERIFY → SETTLE / REFUND
```

---

## 10-Step External Tester Protocol

Follow these 10 steps to test Pactra from scratch without needing to read repository source code:

### Step 1: Install Lace Wallet
- Download and install the **Midnight Lace** browser extension (available for Chromium browsers including Chrome and Brave).
- Set up a new, dedicated **test wallet** and record your testnet recovery phrase securely.

### Step 2: Switch to Midnight Preprod Network
- Open Midnight Lace.
- Navigate to **Settings** > **Network**.
- Select **Midnight Preprod** (or configure custom RPC if using a private testbed node).

### Step 3: Obtain Testnet DUST (tDUST)
- Visit the official Midnight Preprod Faucet or testnet community dispenser.
- Enter your Lace Midnight test address.
- Request testnet tDUST (e.g. 50–100 tDUST) to fund task escrows and gas fees.
- Verify that your Lace balance updates before proceeding.

### Step 4: Open Pactra
- Access the deployed public dApp or launch locally:
  - Public URL: `https://agent-commerce-midnight.vercel.app` (or your team's deployment URL)
  - Local URL: `http://localhost:3000`
- Confirm that the top banner displays: `MIDNIGHT PREPROD / TESTNET` and version `v0.5.0-preprod`.

### Step 5: Complete Onboarding
- When opening the app for the first time, review the **Pactra Protocol Overview**:
  1. Non-Custodial Agent Authority: Agents receive bounded per-task allowances, never your wallet seed.
  2. Zero-Knowledge State Privacy: Task details, prompts, and policy limits remain encrypted off-chain.
  3. Preprod Safety Advisory: Confirm you are using a dedicated test wallet.
- Click **"Get Started"** to enter the main dashboard.
- Click **"Connect Lace"** in the top navigation header and approve the connection in Lace.

### Step 6: Create a Bounded Task
- In the **Task Management** panel, enter:
  - **Task Title / Objective**: e.g., `Train Sentiment Classifier on Sanitized Reviews`
  - **Total Budget Limit**: e.g., `25.0 tDUST`
  - **Max Spend Per Call**: e.g., `10.0 tDUST`
  - **Category Whitelist**: Select `COMPUTE` (or multiple categories: `STORAGE`, `API_CALL`)
  - **Arbitration Policy**: Default (3 Arbitrators, 2/3 threshold)
- Click **"Create Bounded Task"**.
- Notice the cryptographic `policyCommitment` generated locally via Blake2b hashing.

### Step 7: Run the COMPUTE Demo
- Switch to the **"Demo Walkthrough"** tab or browse the **Service Marketplace**.
- Select the verified `Decentralized AI Training Node` provider.
- Click **"Authorize Procurement"** to instantiate a bounded agent request under your task policy.
- Confirm the escrow funding transaction in Lace (or observation in demo simulation testbed).

### Step 8: Observe the Privacy Boundary
- Navigate to the **Privacy Commitment Inspector** in the walkthrough.
- Verify what is visible on the public Midnight ledger vs what remains private:
  - **Public On-Chain**: Task ID, Escrowed balance, hashed Policy Commitment, Service provider public key, Escrow state (`ACTIVE`).
  - **Private Off-Chain (Kept on your machine)**: Task plaintext description, proprietary prompt parameters, uncommitted execution logs, agent internal memory.

### Step 9: Complete or Refund the Task
- Submit verification evidence (hash of computation results, SHA-256 result artifact).
- Execute **"Verify Evidence & Settle Escrow"**:
  - The escrow releases funds strictly to the service provider.
  - Or, test the **"Claim Refund / Dispute"** path to verify that unspent funds return safely to your wallet.

### Step 10: Submit Structured Feedback
- Click the **"💬 Feedback"** button in the header (or navigate to the Feedback section).
- Complete the 5-point rating across:
  - Onboarding Clarity
  - Lace Wallet Connection
  - Privacy Boundary Understanding
  - Bounded Policy Configuration
  - Overall Usability
- Enter any bug reports, confusing steps, or feature requests.
- Click **"Submit Anonymous Feedback"** (or click **"Export as GitHub Issue"** to file on our repository).

---

## Troubleshooting & Error Recovery

Pactra provides actionable error recovery for all common failure paths:

| Issue / Error | Root Cause | Recovery Action |
| :--- | :--- | :--- |
| **"Midnight Lace wallet extension was not detected"** | Lace extension is not installed or disabled. | Install Midnight Lace from official source, enable extension, and refresh page. |
| **"Lace is locked or busy"** | Extension is locked with password or another prompt is open. | Open the Lace popup, enter your password to unlock, and click "Connect Lace" again. |
| **"Connection rejected by user"** | You cancelled the connection prompt. | Click "Connect Lace" when ready to approve the connection. |
| **"Wrong Network Detected"** | Wallet is configured to Devnet or Localnet instead of Preprod. | Open Lace > Settings > Network, switch to **Midnight Preprod**, and reload. |
| **"Insufficient DUST balance"** | Wallet balance is lower than escrow deposit + transaction fee. | Request tDUST from the Preprod faucet (see Step 3) before creating escrow. |
| **"Transaction rejected by user"** | You clicked "Reject" in the Lace signing popup. | The transaction is safely aborted; no funds were moved. Retry when ready. |
| **"Transaction timeout / Indexer delay"** | Midnight Preprod network blocks are being indexed. | Wait 15–30 seconds for the indexer to sync. Do not spam multiple transactions. |
| **"Browser refreshed during transaction"** | Page reload while action was in flight. | Pactra caches active task state in local storage; reconnect Lace to resume state view. |
| **"Duplicate Action Warning"** | Rapid double-clicks on transaction buttons. | Buttons are automatically locked while requests are pending to prevent double-spend. |

---

## Privacy Notice to Testers

- Pactra **never** requests or stores private keys, seed phrases, or wallet secrets.
- Product telemetry records only non-sensitive aggregate events (e.g. `WALLET_CONNECTED`, `TASK_CREATED`, `PROCUREMENT_SUCCESS`).
- Prompts, raw data, task plaintexts, and private parameters are cryptographically excluded from telemetry and feedback reports.
