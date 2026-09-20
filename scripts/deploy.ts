/**
 * Midnight Preprod Testnet Deployment & Verification Script
 *
 * Network: Midnight Preprod Testnet (Target Environment)
 * Network ID: preprod
 * Indexer: https://indexer.preprod.midnight.network/api/v4/graphql
 * Indexer WS: wss://indexer.preprod.midnight.network/api/v4/graphql/ws
 * RPC Node: https://rpc.preprod.midnight.network
 * Faucet: https://midnight-tmnight-preprod.nethermind.dev/
 */

import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MidnightDeploymentConfig {
  networkId: string;
  indexerUri: string;
  indexerWsUri: string;
  nodeUri: string;
  faucetUri: string;
  contractArtifactsDir: string;
}

export const PREPROD_CONFIG: MidnightDeploymentConfig = {
  networkId: "preprod",
  indexerUri: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWsUri: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  nodeUri: "https://rpc.preprod.midnight.network",
  faucetUri: "https://midnight-tmnight-preprod.nethermind.dev/",
  contractArtifactsDir: path.resolve(__dirname, "..", "contract", "src", "managed", "task_escrow"),
};

export async function verifyAndPrepareDeployment(): Promise<void> {
  console.log("==========================================================");
  console.log("   Midnight TaskEscrow Preprod Deployment & Audit         ");
  console.log("==========================================================");
  console.log(`Network ID:        ${PREPROD_CONFIG.networkId}`);
  console.log(`Indexer URI:       ${PREPROD_CONFIG.indexerUri}`);
  console.log(`RPC Node URI:      ${PREPROD_CONFIG.nodeUri}`);
  console.log(`Faucet URI:        ${PREPROD_CONFIG.faucetUri}`);
  console.log(`Artifacts Path:    ${PREPROD_CONFIG.contractArtifactsDir}`);

  // 1. Verify contract compiled artifacts
  const contractArtifact = path.join(PREPROD_CONFIG.contractArtifactsDir, "contract", "index.js");
  const contractDts = path.join(PREPROD_CONFIG.contractArtifactsDir, "contract", "index.d.ts");
  if (!fs.existsSync(contractArtifact) || !fs.existsSync(contractDts)) {
    throw new Error(
      `Compiled contract artifacts missing at ${contractArtifact}. Run "npm run compile:contract" first.`
    );
  }

  const artifactBytes = fs.readFileSync(contractArtifact);
  const artifactHash = crypto.createHash("sha256").update(artifactBytes).digest("hex");
  console.log(`\n[Artifact Integrity]`);
  console.log(`Contract JS Size:  ${artifactBytes.length} bytes`);
  console.log(`Artifact SHA-256:  ${artifactHash}`);

  // 2. Query live Midnight Preprod Indexer to verify network health
  console.log(`\n[Network Verification] Connecting to Midnight Preprod Indexer...`);
  try {
    const res = await fetch(PREPROD_CONFIG.indexerUri, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ currentEpochInfo { epochNo } block(offset: { height: 1 }) { hash } }" }),
    });
    const json = (await res.json()) as any;
    if (json.data?.currentEpochInfo?.epochNo) {
      console.log(`✓ Midnight Preprod Indexer is LIVE.`);
      console.log(`  Current Preprod Epoch:  ${json.data.currentEpochInfo.epochNo}`);
      console.log(`  Genesis Block Hash:     ${json.data.block?.hash}`);
    } else {
      console.warn("  Unexpected indexer response:", json);
    }
  } catch (err: any) {
    console.error("  Failed to reach Midnight Preprod Indexer:", err.message);
  }

  // 3. Deployment status and required authorization actions
  console.log(`\n[Deployment Status]`);
  console.log(`Status: PENDING USER-AUTHORIZED TRANSACTION`);
  console.log(`Reason: Midnight smart contract deployment requires zero-knowledge proof generation`);
  console.log(`        and transaction fee balancing with tNight/Dust tokens.`);
  console.log(`\nTo broadcast the deployment transaction to Preprod:`);
  console.log(`1. Launch the frontend DApp: "npm run dev:ui"`);
  console.log(`2. Open http://localhost:3000 in a browser with the Midnight Lace extension installed.`);
  console.log(`3. Ensure Lace wallet network is set to "Preprod" in Settings -> Network.`);
  console.log(`4. Acquire testnet tNight/Dust from ${PREPROD_CONFIG.faucetUri}`);
  console.log(`5. Click "Connect Lace Wallet" and confirm the deployment transaction.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyAndPrepareDeployment().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
  });
}
