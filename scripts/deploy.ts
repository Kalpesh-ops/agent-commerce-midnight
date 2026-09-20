/**
 * Midnight Preprod Testnet Deployment Script for TaskEscrow Contract
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

export async function deployContract(): Promise<void> {
  console.log("==================================================");
  console.log("   Midnight TaskEscrow Deployment Manifest        ");
  console.log("==================================================");
  console.log(`Target Network:   ${PREPROD_CONFIG.networkId}`);
  console.log(`Indexer URI:      ${PREPROD_CONFIG.indexerUri}`);
  console.log(`Node URI:         ${PREPROD_CONFIG.nodeUri}`);
  console.log(`Artifacts Path:   ${PREPROD_CONFIG.contractArtifactsDir}`);

  // Verify compiled artifacts
  const contractArtifact = path.join(PREPROD_CONFIG.contractArtifactsDir, "contract", "index.js");
  if (!fs.existsSync(contractArtifact)) {
    throw new Error(
      `Compiled contract artifacts missing at ${contractArtifact}. Run "npm run compile:contract" first.`
    );
  }

  console.log("Compiled contract artifacts verified.");
  console.log("Deployment manifest prepared for Midnight Preprod Testnet.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deployContract().catch((err) => {
    console.error("Deployment preparation failed:", err);
    process.exit(1);
  });
}
