# Changelog

All notable changes to the **Pactra** protocol and dApp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0-preprod] - 2026-09-21

### Level 5: Full Moon — External Users & Feedback Loop

#### Added
- **Structured Tester Feedback System**: In-app feedback modal (`FeedbackModal.tsx`) with 5-axis rating scale (1–5) and one-click GitHub Issue export.
- **Developer Feedback Dashboard**: Internal developer-facing analytics and feedback review console (`FeedbackDashboard.tsx`) with category breakdown and export capabilities.
- **Privacy-Preserving Telemetry Service**: Client-side non-sensitive telemetry logger (`telemetryService.ts`) with cryptographic parameter scrubbing, automated secret detection, and local event aggregation.
- **Preprod Safety Banner**: Persistent warning banner (`SafetyBanner.tsx`) prominently highlighting Midnight Preprod network status, testnet token zero-value notice, and dedicated test wallet advisory.
- **Truthful Product Metrics View**: Dedicated dashboard (`ProductMetricsView.tsx`) strictly segregating real Midnight Preprod on-chain metrics from local simulation testbed data.
- **External Tester Protocol**: Comprehensive 10-step testing workflow and error recovery manual (`docs/tester-guide.md`).
- **Feedback-to-Iteration Log**: Structured issue tracking and resolution log (`docs/feedback-log.md`).
- **Automated Security Scanner Enhancements**: Extended `scripts/check-security.js` with regex audits against localStorage secret storage and unauthorized telemetry logging.

#### Changed
- **Header Navigation**: Integrated `v0.5.0-preprod` version badge, Midnight Preprod network status indicator, and direct "💬 Feedback" button.
- **Action Panel Hardening**: Added duplicate transaction submission locks (`isProcessing`) and contextual recovery guidance for failed operations.
- **Indexer Performance**: Implemented page visibility listener (`visibilitychange`) to pause indexer polling when backgrounded, conserving browser resources.

#### Security
- Verified zero private keys, seed phrases, or wallet secrets stored in localStorage or transmitted in telemetry payloads.
- Preserved core non-custodial invariant: agents receive bounded per-task escrow authorization, never user wallet access.

---

## [0.4.0-preprod] - 2026-09-21

### Level 4: Waxing Gibbous — Public MVP
- Real Preprod MVP with end-to-end user flow: `Task Creation` → `Policy Envelope` → `Agent Authorization` → `Procurement` → `Escrow` → `Verification` → `Settlement`.
- Interactive 9-step COMPUTE walkthrough.
- Privacy commitment inspector and dual-state simulation testbed.
- First-time user onboarding modal with protocol guarantees.
- Expanded test suite to 90 passing tests across contract and UI packages.

---

## [0.3.0-preprod] - 2026-09-21

### Level 3: First Quarter — Multi-Service Marketplace & Arbitration
- Generalized 5-category service marketplace: `COMPUTE`, `STORAGE`, `API_CALL`, `DEPLOYMENT`, `DATA_PROCESSING`.
- Threshold M-of-N arbitration engine with multi-signature dispute resolution.
- Blake2b cryptographic policy commitment binding on-chain.
- CI/CD automation pipeline with GitHub Actions workflows.

---

## [0.2.0-preprod] - 2026-09-20

### Level 2: Crescent — Bounded Agent Capability & Policy Engine
- Non-custodial `TaskPolicy` capability model: budget caps, per-call spending limits, service whitelist.
- Procurement engine authorization and execution evidence verification.
- Initial agent client abstraction.

---

## [0.1.0-preprod] - 2026-09-20

### Level 1: New Moon — TaskEscrow Compact Contract & Lace Integration
- Core Compact smart contract `task_escrow.compact` deployed to Midnight Preprod.
- Deterministic Lace wallet connector state machine.
- Initial escrow lifecycle: `Created` → `Funded` → `Active` → `Completed` / `Disputed`.
