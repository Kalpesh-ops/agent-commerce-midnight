# Pactra Release & Deployment Checklist (v0.6.0-eclipse)

This checklist specifies the required verification gates and deployment procedure for publishing releases of **Pactra** on Midnight Preprod and staging Mainnet deployments.

---

## 1. Automated Pre-Release Quality Gates

All checks must pass with zero warnings or errors prior to tag creation or public deployment:

```bash
# 1. Static Type Checking (contract & ui packages)
npm run typecheck

# 2. Automated Test Suite (All 164+ tests passing across 17 suites)
npm run test

# 3. Compact Smart Contract Compilation
npm run compile:contract

# 4. Production UI Bundle Build
npm run build:ui

# 5. Static Security & Secret Audit Gate
npm run check:security
```

Full pipeline convenience command:
```bash
npm run ci
```

---

## 2. Midnight Network Configuration & Preprod Integrity

- [ ] **Contract Address Verification**:
  - Verify that the active contract configuration points to the verified Midnight Preprod deployment identifier:
    `0200021c172da6a603bf236166ebfc00e3185392fe8890731fc612140bb0d970923f`
- [ ] **Network Indicator**:
  - Verify that the application UI clearly displays `MIDNIGHT PREPROD / TESTNET` in the top safety banner and navigation header.
- [ ] **Version Identifier**:
  - Verify that the header displays the release version tag `v0.5.0-preprod`.
- [ ] **Zero-Value Notice**:
  - Confirm warning modal and banner remind testers that tDUST holds no real-world monetary value.

---

## 3. Privacy & Non-Custodial Security Audit

- [ ] **No Secret Storage**:
  - Verify that browser `localStorage` contains only non-sensitive caching keys (`pactra_onboarding_completed`, `pactra_active_task_v1`, `pactra_telemetry_events_v1`, `pactra_tester_feedback_v1`).
  - Confirm NO private keys, seed phrases, or wallet secrets are ever stored or logged.
- [ ] **Telemetry Scrubbing**:
  - Verify that `telemetryService` rejects any payload containing keys matching `/private|secret|seed|prompt|key/i` or 64-character hex strings.
- [ ] **Agent Authority Boundary**:
  - Confirm the agent client cannot sign arbitrary transactions or access user treasury funds outside the designated escrow deposit.

---

## 4. Production Deployment Workflow (Vercel / Cloudflare)

1. **Clean Workspace & Push**:
   ```bash
   git status
   # Ensure working tree clean
   git push origin main
   ```
2. **Vercel Production Build**:
   - Vercel automatically builds via root configuration `vercel.json`:
     - Build Command: `npm run build:ui`
     - Output Directory: `ui/dist`
     - Install Command: `npm install`
3. **Smoke Test Production URL**:
   - Navigate to the production URL.
   - Open browser Developer Tools > Console: assert zero unhandled exceptions.
   - Test "Connect Lace" extension handshake.
   - Complete 1 test task flow: Create Task → Escrow → Verify → Settle.
   - Open Feedback Modal and verify submit action.

---

## 5. Rollback & Disaster Recovery Procedures

In the event of an unhandled runtime error or Midnight network breaking change:

1. **Immediate Frontend Rollback**:
   - In Vercel Project Dashboard > Deployments, locate the previous stable deployment (e.g. Commit `f7e36fb` - Level 4 MVP).
   - Click **"Instant Rollback"** to redirect DNS traffic within 10 seconds.
2. **Git Recovery**:
   ```bash
   # Revert offending commit if necessary
   git revert <commit-hash>
   git push origin main
   ```
3. **Local Storage Reset for Testers**:
   - If a schema migration issue affects cached state, instruct users to click "Reset Local State" in the header or run:
     ```javascript
     localStorage.clear();
     location.reload();
     ```
4. **Contract Emergency**:
   - Because Compact contracts on Midnight are immutable, if a contract-level bug is discovered:
     1. Update the contract address in `ui/src/config/midnight.ts`.
     2. Release an expedited patch release (`v0.5.1-preprod`).
