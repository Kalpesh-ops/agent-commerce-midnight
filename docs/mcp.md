# Pactra Model Context Protocol (MCP) Integration

> **Core Security Principle:**
> *"Give an agent a goal and bounded economic authority — not your wallet."*

This document explains how autonomous AI agents (such as Claude, Cursor, AutoGPT, or custom agent runtimes) interact with Pactra using the **Model Context Protocol (MCP)**.

---

## 1. Overview & Architecture

The Model Context Protocol (MCP) provides an open standard for LLMs and autonomous agents to safely invoke tools and consume context from external environments.

In traditional agent setups, giving an agent the ability to purchase services requires giving it access to a funded cryptocurrency wallet or API credit card. This creates catastrophic security risks:
- Prompt injection or hallucination can drain the entire treasury.
- Unbounded loops can spend tens of thousands of dollars before human intervention.
- The agent has unrestricted authority to send funds anywhere.

Pactra solves this by placing the **Pactra Policy Engine** between the MCP tool interface and the economic ledger:

```
+-------------------------------------------------------------------------+
|                         AUTONOMOUS AI AGENT                             |
|          (Claude 3.5 Sonnet / GPT-4o / Local Llama / DeepSeek)           |
+-------------------------------------------------------------------------+
                                    |
                                    | MCP Tool Calls (JSON-RPC)
                                    v
+-------------------------------------------------------------------------+
|                       PACTRA MCP SERVER / ADAPTER                       |
|                                                                         |
|  Exposes:                                                               |
|    - pactra_discover_services                                           |
|    - pactra_get_quote                                                   |
|    - pactra_request_procurement                                         |
|    - pactra_submit_evidence                                             |
|    - pactra_get_task_status                                             |
+-------------------------------------------------------------------------+
                                    |
                                    | Strictly Validated Calls
                                    v
+-------------------------------------------------------------------------+
|                          PACTRA POLICY ENGINE                           |
|                                                                         |
|  - Checks TaskPolicy envelope bounds                                   |
|  - Enforces per-transaction and total budget caps                       |
|  - Validates service allowlist and capability whitelist                |
|  - Blocks ANY attempt to access private keys or generic transfers       |
+-------------------------------------------------------------------------+
                                    |
                                    v (Authorized Capability Tokens)
+-------------------------------------------------------------------------+
|                  MIDNIGHT NETWORK TASK ESCROW DAPP                      |
|                  (Preprod Smart Contract Verification)                  |
+-------------------------------------------------------------------------+
```

---

## 2. Supported MCP Tools

Pactra defines 5 canonical MCP tools in `contract/src/pactra/mcp/toolDefinitions.ts`:

### 1. `pactra_discover_services`
- **Purpose:** Search available decentralized providers by capability category or pricing constraints.
- **Input Parameters:**
  - `category` *(optional string)*: `"COMPUTE" | "STORAGE" | "API_CALL" | "DEPLOYMENT" | "DATA_PROCESSING"`
  - `maxUnitPrice` *(optional number)*: Filter out services exceeding this unit cost in DUST.
- **Returns:** List of matching registered services with pricing, SLA, and verification methods.

### 2. `pactra_get_quote`
- **Purpose:** Request a binding price quote and resource estimate for a specific service.
- **Input Parameters:**
  - `serviceId` *(string, required)*: The target service ID (e.g., `srv_compute_alpha`).
  - `parameters` *(optional object)*: Workload specifications (duration, payload size).
- **Returns:** Total cost in DUST, expiration timestamp, and terms.

### 3. `pactra_request_procurement`
- **Purpose:** Request bounded authorization and micro-procurement under the agent's assigned `TaskPolicy`.
- **Input Parameters:**
  - `serviceId` *(string, required)*: Approved service ID.
  - `jobId` *(string, required)*: Unique job identifier for tracking.
  - `inputPayloadHash` *(string, required)*: SHA-256 hash of the input dataset/instructions.
  - `maxCost` *(number, required)*: Maximum allowable cost in DUST for this execution.
- **Returns:** `procurementId`, status (`AUTHORIZED`), and cryptographically signed `authToken`.
- **Security Check:** Fails immediately if `maxCost` exceeds `policy.maxSpendPerTransaction` or `policy.maxTotalBudget`.

### 4. `pactra_submit_evidence`
- **Purpose:** Submit cryptographic execution evidence (attestation, result hash, provider signature) after workload completion.
- **Input Parameters:**
  - `procurementId` *(string, required)*: The active procurement ID.
  - `outputHash` *(string, required)*: Hash of the generated result.
  - `evidenceSignature` *(string, required)*: Cryptographic signature from the service provider.
  - `costIncurred` *(number, required)*: Actual billed amount in DUST.
- **Returns:** Verification status (`VERIFIED` or `FAILED`) and reason.

### 5. `pactra_get_task_status`
- **Purpose:** Query current budget utilization, remaining allowance, active procurements, and escrow status.
- **Input Parameters:** None.
- **Returns:** Summary of authorized policy, total spent, remaining balance, and active escrow state.

---

## 3. Strict Security Invariants

The MCP interface enforces non-negotiable security rules:
1. **Zero Private Key Access:** The agent client has no access to seed phrases, private keys, or wallet signing credentials.
2. **No Arbitrary Transfers:** There is no `transfer()` or `send_funds()` tool. The agent can only request procurement from verified services matching the user's policy allowlist.
3. **Deterministic Authority Boundary:** Any attempt by the LLM to exceed its per-transaction limit or procure an unauthorized service category results in a rejection error returned directly to the agent.

---

## 4. Configuring Claude Desktop or Cursor for Pactra MCP

To connect Claude Desktop or an MCP-compatible IDE to Pactra:

### Claude Desktop Configuration (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "pactra": {
      "command": "node",
      "args": [
        "/path/to/agent-commerce-midnight/contract/dist/mcp/server.js"
      ],
      "env": {
        "PACTRA_NETWORK": "preprod",
        "PACTRA_TASK_ID": "task_autonomous_001"
      }
    }
  }
}
```

### Programmatic Usage via TypeScript
```typescript
import { PactraAgentClient, PactraMcpAdapter } from "@agent-commerce/contract";

// 1. User configures policy envelope
const client = new PactraAgentClient(taskPolicyEnvelope);

// 2. Initialize MCP adapter
const mcp = new PactraMcpAdapter(client);

// 3. Agent executes bounded tool call
const result = await mcp.executeTool("pactra_discover_services", {
  category: "COMPUTE",
  maxUnitPrice: 5,
});

console.log(result.content[0].text);
```

---

## 5. Current Limitations (Level 4 MVP)

1. **Local MCP Adapter:** In Level 4, the adapter runs locally in Node.js or in-browser. Production remote SSE (Server-Sent Events) MCP deployment will be expanded in Level 5.
2. **Synchronous Tool Calls:** Tool execution waits for off-chain policy verification; on-chain Midnight block confirmations occur asynchronously through the `escrowService` lifecycle.
3. **Simulated Sandbox Providers:** Default providers in the registry run verified sandbox nodes. Production hardware SGX remote attestation verification will be integrated with live mainnet nodes.
