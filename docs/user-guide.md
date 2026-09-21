# Pactra User Guide & Preprod MVP Tester Manual

Welcome to **Pactra: Autonomous Agent Commerce & Escrow Protocol** on the **Midnight Network**.

This guide is written for external developers, testers, and evaluators who want to connect to Pactra on **Midnight Preprod Testnet** and experience bounded agentic commerce.

---

## 1. Quickstart Requirements

To interact with Pactra on Midnight Preprod, you need:
1. **Node.js**: Version 18.x, 20.x, or 22.x.
2. **Modern Chromium Browser**: Brave, Google Chrome, or Microsoft Edge.
3. **Midnight Lace Wallet Extension**: Installed in your browser.
4. **Preprod tNIGHT / DUST**: Free testnet tokens from the Midnight Faucet.

---

## 2. Setting Up Midnight Lace Wallet

If you do not yet have the Midnight Lace wallet:
1. Download and install the **Midnight Lace Extension** from the official Midnight developer portal or Chrome Web Store.
2. Open Lace, create or restore a wallet, and securely record your recovery phrase.
3. In Lace Settings, switch your network to **Midnight Preprod**.
4. Request testnet tokens from the **Nethermind Preprod Faucet** (`https://faucet.preprod.midnight.network/`).
5. Wait for the faucet transaction to confirm in Lace (your balance will show testnet DUST / tNIGHT).

---

## 3. Launching the Pactra dApp Locally

Clone and run Pactra in your local environment:

```bash
# 1. Clone the repository
git clone https://github.com/Kalpesh-ops/agent-commerce-midnight.git
cd agent-commerce-midnight

# 2. Install all dependencies across workspace
npm install

# 3. Compile the Compact contract & build packages
npm run compile:contract
npm run build:contract

# 4. Launch the local UI development server
npm run dev:ui
```

Open your browser to:
**`http://localhost:3000/`**

---

## 4. First-Time Guided Walkthrough (3-Minute Tour)

When you first load Pactra:
1. Click **"Connect Midnight Lace"** in the top navigation header.
2. Accept the Lace permission dialog to authorize connection to `Midnight Preprod`.
3. Notice your shielded coin public key appears in the top-right header, confirming real cryptographic connectivity.
4. Check the **Preprod Indexer** indicator: it will show `Preprod Indexer: Online (Epoch Active)` once the Midnight GraphQL indexer confirms block sync.
5. Click **"⚡ Guided Compute MVP"** tab in the navigation bar to experience the complete 9-step flow:
   - **Step 1:** Create a private task without broadcasting sensitive objectives.
   - **Step 2:** Define budget (10 DUST cap, 3 DUST per transaction) and granted capabilities (`COMPUTE`).
   - **Step 3:** Issue a cryptographic **Policy Commitment**. The agent receives bounded authority, never your wallet seed phrase!
   - **Step 4:** Query the service registry for verified compute enclaves (`srv_compute_alpha`).
   - **Step 5:** Agent requests micro-procurement. Policy engine checks spending constraints.
   - **Step 6:** Lock escrow for 3 DUST.
   - **Step 7:** Receive confidential execution evidence from the secure enclave.
   - **Step 8:** The objective verifier checks attestation and result hashes against initial commitments.
   - **Step 9:** Escrow unlocks payout to the service provider.

---

## 5. Live On-Chain Contract Interaction

In the **"🏛️ Task & Protocol"** tab, you can deploy or join genuine Midnight smart contracts:
- **Deploy New Escrow Contract:** Click *"Deploy Escrow Contract"*. Lace will open a signing popup, generate the zero-knowledge witness proof locally, and submit the deployment transaction to Preprod.
- **Join Existing Contract:** If you or a teammate already deployed a contract, paste the contract address into the *"Join Existing Contract"* field to query its live state directly from the Midnight Indexer.
- **Fund / Accept / Complete / Settle:** Each action transitions the on-chain Compact state machine (`TaskEscrow.compact`) with verifiable ZK proofs.

---

## 6. Troubleshooting Common Issues

### Issue 1: Lace Wallet Popup Does Not Appear
- **Cause:** Browser popups may be blocked or another extension dialog is already open in the background.
- **Fix:** Click the Lace extension icon in your browser toolbar to bring pending authorization popups to the front. Click *"🔄 Retry Connect"* in Pactra.

### Issue 2: "Wrong Network" or Network Inconsistency
- **Cause:** Lace is connected to Undeployed/Local network rather than Preprod.
- **Fix:** Open Lace Settings, ensure the network dropdown is set to **"Preprod"**, and refresh Pactra.

### Issue 3: Contract Address Not Found in Indexer
- **Cause:** Midnight block times range between 6 to 20 seconds. If a contract was just deployed, the indexer requires 1-2 blocks to index the new state.
- **Fix:** Click *"🔄 Refresh Indexer"* in the Task Details card after 15-30 seconds.

### Issue 4: Insufficient DUST Balance
- **Cause:** Your wallet has 0 DUST or only unshielded funds.
- **Fix:** Use the official Nethermind Preprod Faucet to fund your address, and ensure funds are shielded into the DUST balance pool.

---

## 7. Providing Tester Feedback

We actively welcome bug reports, UX suggestions, and architectural feedback.
Please submit feedback via:
- GitHub Issues: [New Issue Template](https://github.com/Kalpesh-ops/agent-commerce-midnight/issues)
- Dedicated Feedback File: [docs/feedback.md](file:///e:/repos/agent-commerce-midnight/docs/feedback.md)
