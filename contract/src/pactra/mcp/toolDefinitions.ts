/**
 * Pactra — Model Context Protocol (MCP) Tool Definitions
 *
 * Exposes Pactra's autonomous economic operating layer to LLMs (Claude Desktop,
 * Cursor, AutoGPT) via standard JSON Schema tool declarations.
 *
 * CRITICAL SECURITY INVARIANT:
 * Every MCP tool maps to the underlying TaskPolicy envelope.
 * The model NEVER receives wallet keys or generic transaction broadcasting tools.
 */

export interface McpToolDeclaration {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, unknown>;
    readonly required?: string[];
  };
}

export const PACTRA_MCP_TOOLS: readonly McpToolDeclaration[] = [
  {
    name: "pactra_discover_services",
    description:
      "Discover verified digital services in the Pactra marketplace (COMPUTE, STORAGE, API_CALL, DEPLOYMENT, DATA_PROCESSING) filtered by category or max unit price.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["COMPUTE", "STORAGE", "API_CALL", "DEPLOYMENT", "DATA_PROCESSING"],
          description: "Optional capability category filter.",
        },
        maxUnitPrice: {
          type: "string",
          description: "Maximum acceptable price per unit as a stringified integer (e.g., '2').",
        },
      },
    },
  },
  {
    name: "pactra_get_quote",
    description:
      "Request a cryptographically verified pricing quote and check authorization against the active TaskPolicy budget and capability bounds.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "The unique identifier of the target service (e.g., 'srv_compute_alpha').",
        },
      },
      required: ["serviceId"],
    },
  },
  {
    name: "pactra_request_procurement",
    description:
      "Reserve escrow funds and procure an authorized marketplace service under the active TaskPolicy envelope. Fails if capability or budget is exceeded.",
    inputSchema: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          description: "The ID of the approved service to procure.",
        },
        payloadHash: {
          type: "string",
          description: "Hex-encoded hash of the input dataset or instructions.",
        },
        jobId: {
          type: "string",
          description: "Optional custom job tracking identifier.",
        },
      },
      required: ["serviceId"],
    },
  },
  {
    name: "pactra_submit_evidence",
    description:
      "Submit execution evidence produced by an authorized service provider for cryptographic verification.",
    inputSchema: {
      type: "object",
      properties: {
        procurementId: {
          type: "string",
          description: "The procurement identifier returned during request_procurement.",
        },
        simulateFailure: {
          type: "string",
          enum: ["REJECTED", "TIMEOUT", "INVALID_EVIDENCE", "REPLAY_EVIDENCE"],
          description: "Optional simulation flag for testing failure scenarios.",
        },
      },
      required: ["procurementId"],
    },
  },
  {
    name: "pactra_get_task_status",
    description:
      "Query current task execution progress, total spent, remaining escrow budget, and active procurement count.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "pactra_request_dispute",
    description:
      "Initiate a multi-party arbitration dispute for a failed, contested, or SLA-violating procurement.",
    inputSchema: {
      type: "object",
      properties: {
        procurementId: {
          type: "string",
          description: "The procurement identifier under dispute.",
        },
        reason: {
          type: "string",
          description: "Clear factual explanation of the dispute or SLA failure.",
        },
        claimant: {
          type: "string",
          enum: ["CREATOR", "PROVIDER", "AGENT", "AUTOMATED_VERIFIER"],
          description: "The party filing the dispute.",
        },
        evidencePayloadHash: {
          type: "string",
          description: "Optional hex-encoded hash of the contested deliverable or error log.",
        },
      },
      required: ["procurementId", "reason"],
    },
  },
] as const;

export type PactraToolName = (typeof PACTRA_MCP_TOOLS)[number]["name"];

export function getToolDeclaration(name: string): McpToolDeclaration | undefined {
  const normalized = name.startsWith("pactra_") ? name : `pactra_${name}`;
  return PACTRA_MCP_TOOLS.find((t) => t.name === normalized || t.name === name);
}

