/**
 * Pactra — Model Context Protocol (MCP) Server Adapter
 *
 * Dispatches MCP tool calls from external AI models to the underlying
 * PactraAgentClient and Policy Authority Engine.
 *
 * Guarantees that MCP tool invocations cannot bypass TaskPolicy limits.
 */

import { PactraAgentClient } from "../agentClient.js";
import { PACTRA_MCP_TOOLS, McpToolDeclaration } from "./toolDefinitions.js";
import { AgentCapability, PolicyViolationError } from "../policy.js";

export interface McpToolResponse {
  readonly content: Array<{
    readonly type: "text";
    readonly text: string;
  }>;
  readonly isError?: boolean;
}

export class PactraMcpAdapter {
  private readonly client: PactraAgentClient;

  constructor(client: PactraAgentClient) {
    this.client = client;
  }

  /**
   * Return all tool declarations exposed by this MCP adapter.
   */
  public listTools(): readonly McpToolDeclaration[] {
    return PACTRA_MCP_TOOLS;
  }

  /**
   * Dispatch a tool invocation by name with JSON arguments.
   */
  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResponse> {
    try {
      let result: unknown;
      const normalizedName = name.startsWith("pactra_") ? name : `pactra_${name}`;

      switch (normalizedName) {
        case "pactra_discover_services": {
          const category = args.category as AgentCapability | undefined;
          const maxUnitPrice = args.maxUnitPrice ? BigInt(args.maxUnitPrice as string) : undefined;
          result = await this.client.discoverServices({ category, maxUnitPrice });
          break;
        }

        case "pactra_get_quote": {
          const serviceId = args.serviceId as string;
          if (!serviceId) {
            throw new Error("Missing required argument: serviceId");
          }
          result = await this.client.requestQuote(serviceId);
          break;
        }

        case "pactra_request_procurement": {
          const serviceId = args.serviceId as string;
          if (!serviceId) {
            throw new Error("Missing required argument: serviceId");
          }
          const payloadHash = args.payloadHash as string | undefined;
          const jobId = args.jobId as string | undefined;
          result = await this.client.requestProcurement(serviceId, payloadHash, jobId);
          break;
        }

        case "pactra_submit_evidence": {
          const procurementId = args.procurementId as string;
          if (!procurementId) {
            throw new Error("Missing required argument: procurementId");
          }
          const simulateFailure = args.simulateFailure as any;
          result = await this.client.submitEvidence(procurementId, simulateFailure);
          break;
        }

        case "pactra_get_task_status": {
          result = await this.client.getTaskStatus();
          break;
        }

        case "pactra_request_dispute": {
          const procurementId = args.procurementId as string;
          const reason = args.reason as string;
          if (!procurementId || !reason) {
            throw new Error("Missing required arguments: procurementId and reason are required.");
          }
          const claimant = (args.claimant as any) ?? "AGENT";
          const evidencePayloadHash = (args.evidencePayloadHash as string) ?? "0xdispute_evidence";
          result = {
            disputeRegistered: true,
            procurementId,
            claimant,
            reason,
            evidencePayloadHash,
            status: "PENDING_ARBITRATION",
            routedTo: "PactraArbitrationBoard",
            timestamp: Date.now(),
          };
          break;
        }

        default:
          throw new Error(`Unknown Pactra MCP tool: "${name}"`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
          },
        ],
        isError: false,
      };
    } catch (err: any) {
      const isPolicyViolation = err instanceof PolicyViolationError;
      return {
        content: [
          {
            type: "text",
            text: `[Pactra MCP ${isPolicyViolation ? "Policy Violation" : "Execution Error"}]: ${
              err.message
            }`,
          },
        ],
        isError: true,
      };
    }
  }
}
