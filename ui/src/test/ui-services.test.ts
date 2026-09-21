import { describe, it, expect, beforeEach } from "vitest";
import { walletService } from "../services/wallet.js";
import { pactraUiService } from "../services/pactraUiService.js";
import { escrowService } from "../services/escrowService.js";

describe("Pactra UI Services & State Flow", () => {
  beforeEach(() => {
    walletService.disconnect();
    pactraUiService.resetAll();
    escrowService.resetDemo();
  });

  describe("Wallet Service Deterministic State Machine", () => {
    it("initializes in DISCONNECTED state", () => {
      const state = walletService.getState();
      expect(state.status).toBe("DISCONNECTED");
      expect(state.isConnected).toBe(false);
      expect(state.activeNetwork).toBeFalsy();
    });

    it("handles connection failure gracefully when wallet extension is missing", async () => {
      const result = await walletService.connect("preprod");
      expect(result.isConnected).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.error).toBeDefined();
    });

    it("disconnect resets wallet address and connection flags", () => {
      walletService.disconnect();
      const state = walletService.getState();
      expect(state.isConnected).toBe(false);
      expect(state.coinPublicKey).toBeFalsy();
      expect(state.encryptionPublicKey).toBeFalsy();
    });
  });

  describe("Pactra UI Protocol Service", () => {
    it("initializes with complete protocol state and 5 default marketplace services", () => {
      const state = pactraUiService.getState();
      expect(state.policy).toBeDefined();
      expect(state.policyCommitment).toMatch(/^0x[a-f0-9]{64}$/);
      expect(state.onChainBinding).toBeDefined();
      expect(state.registryServices.length).toBeGreaterThanOrEqual(5);

      const categories = state.registryServices.map((s) => s.category);
      expect(categories).toContain("COMPUTE");
      expect(categories).toContain("STORAGE");
      expect(categories).toContain("API_CALL");
      expect(categories).toContain("DEPLOYMENT");
      expect(categories).toContain("DATA_PROCESSING");
    });

    it("plans a multi-step task and respects budget constraints", () => {
      const prompt = "Deploy high-throughput inference service and replicate logs";
      const plan = pactraUiService.planObjective(prompt);
      expect(plan.actions.length).toBeGreaterThanOrEqual(1);
      expect(plan.totalEstimatedCost).toBeLessThanOrEqual(500n);

      const state = pactraUiService.getState();
      expect(state.activePlan).toBeDefined();
      expect(state.activePlan?.planId).toBe(plan.planId);
    });

    it("executes generalized procurement across multiple capability categories", async () => {
      const computeRecord = await pactraUiService.procureMarketplaceService("srv_compute_alpha");
      expect(computeRecord.status).toBe("SERVICE_ACCEPTED");
      expect(computeRecord.authToken?.authorizedAmount).toBe(2n);

      const storageRecord = await pactraUiService.procureMarketplaceService("srv_storage_gamma");
      expect(storageRecord.status).toBe("SERVICE_ACCEPTED");
      expect(storageRecord.authToken?.authorizedAmount).toBe(1n);

      const state = pactraUiService.getState();
      expect(state.activeProcurements.length).toBe(2);
    });

    it("executes service and verifies objective completion evidence", async () => {
      const procurement = await pactraUiService.procureMarketplaceService("srv_compute_alpha");
      const evidence = await pactraUiService.executeProcurement(procurement.procurementId);
      expect(evidence.outputHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(evidence.jobId).toBe(procurement.jobSpec.jobId);

      const verification = pactraUiService.verifyCompletion(evidence);
      expect(verification.verified).toBe(true);
      expect(verification.checks.jobIdMatches).toBe(true);
      expect(verification.checks.providerAuthorized).toBe(true);
    });

    it("submits arbitrator votes and computes threshold verdict", () => {
      const dispute = pactraUiService.openArbitrationDispute({
        procurementId: "proc_ui_001",
        claimant: "CREATOR",
        reason: "Corrupted output payload reported.",
        amount: 2n,
      });

      expect(dispute.status).toBe("PENDING_ARBITRATION");

      // Cast 2 out of 3 votes for REFUND_CREATOR
      pactraUiService.castArbitrationVote(
        dispute.disputeId,
        "arb_oracle_node_01",
        "REFUND_CREATOR",
        "Corrupted output confirmed by audit."
      );
      const vote2Result = pactraUiService.castArbitrationVote(
        dispute.disputeId,
        "arb_oracle_node_02",
        "REFUND_CREATOR",
        "Hash mismatch observed."
      );

      expect(vote2Result.resolved).toBe(true);
      expect(vote2Result.status).toBe("RESOLVED_REFUND");
      expect(vote2Result.dispute.status).toBe("RESOLVED_REFUND");
    });
  });

  describe("Escrow Service Local State Transitions", () => {
    it("initializes with UNINITIALIZED task state", () => {
      const state = escrowService.getState();
      expect(state.taskState).toBe("UNINITIALIZED");
      expect(state.settlementState).toBe("UNSETTLED");
      expect(state.maxBudget).toBe(0);
      expect(state.escrowedAmount).toBe(0);
    });

    it("resets demo state when requested", () => {
      escrowService.resetDemo();
      const state = escrowService.getState();
      expect(state.taskState).toBe("UNINITIALIZED");
      expect(state.contractAddress).toBeNull();
    });
  });
});
