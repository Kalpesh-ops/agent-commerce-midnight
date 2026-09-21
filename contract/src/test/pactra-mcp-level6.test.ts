import { describe, it, expect, beforeEach } from "vitest";
import { PactraMcpAdapter } from "../pactra/mcp/mcpAdapter.js";
import { PactraAgentClient } from "../pactra/agentClient.js";
import { ServiceRegistry } from "../pactra/registry.js";
import { TaskPolicy, TaskPolicyEnvelope } from "../pactra/policy.js";

describe("Pactra Model Context Protocol (MCP) Level 6 Extensions", () => {
  let adapter: PactraMcpAdapter;
  let client: PactraAgentClient;
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry();

    const policy: TaskPolicy = {
      taskId: "task_mcp_level6",
      maxTotalBudget: 50n,
      maxSpendPerTransaction: 10n,
      allowedCapabilities: ["COMPUTE"],
      approvedCategories: ["COMPUTE"],
      approvedProviders: ["srv_compute_alpha"],
      expirationTimestamp: Date.now() + 60000,
    };

    const envelope: any = {
      taskId: policy.taskId,
      objective: "Level 6 test objective",
      policy,
      allowedCapabilities: policy.allowedCapabilities,
      allowedProviders: policy.approvedProviders,
      budget: {
        userTreasuryTotal: 200n,
        taskEscrowAllocation: 50n,
        currentSpent: 0n,
        remainingBudget: 50n,
        perTransactionLimit: 10n,
      },
      completionConditions: {
        expectedJobId: "job_01",
        expectedProviderCommitment: "srv_compute_alpha",
        maxAllowedCost: 10n,
        isSubjectiveTask: false,
        externalVerifierRequired: false,
        verifierDescription: "Level 6 Verifier",
      },
    };

    client = new PactraAgentClient(envelope, registry);
    adapter = new PactraMcpAdapter(client);
  });

  it("exposes all 6 structured MCP tools including request_dispute", () => {
    const tools = adapter.listTools();
    expect(tools.length).toBe(6);

    const names = tools.map((t) => t.name);
    expect(names).toContain("pactra_discover_services");
    expect(names).toContain("pactra_get_quote");
    expect(names).toContain("pactra_request_procurement");
    expect(names).toContain("pactra_submit_evidence");
    expect(names).toContain("pactra_get_task_status");
    expect(names).toContain("pactra_request_dispute");
  });

  it("successfully invokes pactra_request_dispute with structured arguments", async () => {
    const response = await adapter.callTool("pactra_request_dispute", {
      procurementId: "proc_mcp_test",
      reason: "Provider SLA degraded: response latency exceeded 5000ms",
      claimant: "AGENT",
      evidencePayloadHash: "0xerrlog123",
    });

    expect(response.isError).toBe(false);
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.disputeRegistered).toBe(true);
    expect(parsed.procurementId).toBe("proc_mcp_test");
    expect(parsed.status).toBe("PENDING_ARBITRATION");
  });

  it("accepts normalized tool alias request_dispute", async () => {
    const response = await adapter.callTool("request_dispute", {
      procurementId: "proc_alias_test",
      reason: "Execution checksum failed",
    });

    expect(response.isError).toBe(false);
    const parsed = JSON.parse(response.content[0].text);
    expect(parsed.procurementId).toBe("proc_alias_test");
  });

  it("rejects dispute request missing mandatory arguments", async () => {
    const response = await adapter.callTool("pactra_request_dispute", {
      // missing procurementId and reason
    });

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("Missing required arguments");
  });

  it("strictly rejects forbidden wallet tools and raw transaction requests", async () => {
    const forbiddenTools = [
      "sendTransaction",
      "pactra_sendTransaction",
      "transferFunds",
      "exportPrivateKey",
      "drainTreasury",
    ];

    for (const tool of forbiddenTools) {
      const response = await adapter.callTool(tool, { amount: "100" });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain("Unknown Pactra MCP tool");
    }
  });
});
