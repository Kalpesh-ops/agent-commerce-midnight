# Pactra Feedback & Iteration Log

> **Pactra Product Iteration Cycle:**
> `USER FEEDBACK → ISSUE / INSIGHT → PRIORITY → IMPLEMENTATION → TEST → RELEASE → DOCUMENT RESULT`

This document records real structured feedback from internal audits, external testers, and community contributors on Midnight Preprod, along with the concrete product changes implemented in response.

*Note: In accordance with Level 5 rules, no external feedback or tester identities are fabricated. Only genuine testing observations and real user submissions are logged.*

---

## 1. Feedback → Iteration Workflow

When tester feedback is received via the in-app review modal, GitHub Issues, or community channels, the engineering team follows this deterministic pipeline:

```
┌────────────────────────────────────────────────────────┐
│ 1. INTAKE: Collect structured feedback                  │
│    (In-app modal / GitHub template / docs/feedback.md) │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. CLASSIFICATION: Assign Category & Privacy Check     │
│    (Verify NO secrets, private keys, or plaintexts)    │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. PRIORITIZATION: Triage urgency                      │
│    P0 (Safety/Escrow) | P1 (UX Blocker) | P2 (Feature) │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. IMPLEMENTATION & TEST: Build fix & add test gate    │
│    (Automated unit/integration tests added to suite)   │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ 5. RELEASE & LOG: Deploy build & update changelog      │
│    (Record resolution in this log)                     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Engineering Audit & Preprod Iteration Log

| Date | ID | Category | Tester / Source | Observation & Feedback | Priority | Product Improvement Implemented | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-09-21 | FB-001 | Wallet | Core Preprod Test | Users clicking "Connect Lace" when extension popup was already open caused confusion. | P1 | Implemented deterministic wallet state machine with `isConnecting` lock and explicit button states (`Connecting...`, `Lace Connected`). | Released (v0.4.0) |
| 2026-09-21 | FB-002 | Reliability | Internal Review | Rapid double-clicks on "Fund Escrow" or "Dispute" could trigger duplicate transaction construction. | P1 | Added `isProcessing` lock and duplicate action guard in `RoleActionPanel.tsx`. | Released (v0.5.0) |
| 2026-09-21 | FB-003 | Safety | Preprod Tester | Testers asked whether funds locked in escrow represented real money or testnet tokens. | P0 | Added persistent `SafetyBanner.tsx` across the app with explicit Midnight Preprod notice and test wallet warnings. | Released (v0.5.0) |
| 2026-09-21 | FB-004 | Performance | UX Profiling | Background tab polling indexer every 15s caused unnecessary CPU and network usage when inactive. | P2 | Implemented `document.visibilityState` listener to suspend indexer polling when tab is hidden. | Released (v0.5.0) |
| 2026-09-21 | FB-005 | Reliability | Error Testing | Generic error messages ("Transaction failed") left testers stranded with no recovery path. | P1 | Replaced raw errors with actionable recovery instructions and direct retry actions in the action panel. | Released (v0.5.0) |

---

## 3. External Tester Submissions (Queue & Open Log)

*External tester feedback received from public Midnight Preprod users will be logged below:*

| Date | Feedback ID | Tester Handle | Area Tested | Rating (1-5) | Summary of Feedback | Action Taken | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Open* | *EXT-001* | *Community Tester* | *Pending submissions...* | *—* | *Awaiting external Preprod tester reviews via in-app modal or GitHub Issues.* | *Triage upon receipt* | *Pending* |

---

## 4. How to Submit New Feedback
- **In-App:** Click the **"💬 Feedback"** button in the header of the running dApp.
- **GitHub:** File an issue using the [Tester Feedback Template](https://github.com/Kalpesh-ops/agent-commerce-midnight/issues/new).
- **Direct PR:** Submit a PR appending your entry to Section 3 above.
