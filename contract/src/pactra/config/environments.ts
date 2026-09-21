/**
 * Pactra — Multi-Network Environment Configuration
 *
 * Defines strict, segregated configuration profiles for:
 * 1. LOCAL (in-memory simulator & devnet)
 * 2. PREPROD (Midnight Preprod Testnet)
 * 3. MAINNET (Midnight Production Mainnet)
 *
 * HARD RULE:
 * Mainnet configuration must NEVER silently fall back to Preprod endpoints.
 */

export type PactraEnvironmentId = "LOCAL" | "PREPROD" | "MAINNET";

export interface NetworkEnvironmentProfile {
  readonly environmentId: PactraEnvironmentId;
  readonly networkId: "undeployed" | "testnet" | "mainnet";
  readonly networkName: string;
  readonly isProduction: boolean;
  readonly indexerUri: string;
  readonly indexerWsUri: string;
  readonly defaultProverUri: string | null;
  readonly defaultContractAddress: string | null;
  readonly currencySymbol: string;
  readonly faucetAvailable: boolean;
}

export const LOCAL_ENVIRONMENT: Readonly<NetworkEnvironmentProfile> = Object.freeze({
  environmentId: "LOCAL",
  networkId: "undeployed",
  networkName: "Midnight Local Sandbox / Simulator",
  isProduction: false,
  indexerUri: "http://localhost:8088/api/v1/graphql",
  indexerWsUri: "ws://localhost:8088/api/v1/graphql/ws",
  defaultProverUri: "http://localhost:6300",
  defaultContractAddress: null,
  currencySymbol: "tDUST",
  faucetAvailable: true,
});

export const PREPROD_ENVIRONMENT: Readonly<NetworkEnvironmentProfile> = Object.freeze({
  environmentId: "PREPROD",
  networkId: "testnet",
  networkName: "Midnight Preprod Testnet",
  isProduction: false,
  indexerUri: "https://indexer.preprod.midnight.network/api/v4/graphql",
  indexerWsUri: "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  defaultProverUri: "https://prover.preprod.midnight.network",
  defaultContractAddress: "0200021c172da6a603bf236166ebfc00e3185392fe8890731fc612140bb0d970923f",
  currencySymbol: "tDUST",
  faucetAvailable: true,
});

export const MAINNET_ENVIRONMENT: Readonly<NetworkEnvironmentProfile> = Object.freeze({
  environmentId: "MAINNET",
  networkId: "mainnet",
  networkName: "Midnight Mainnet",
  isProduction: true,
  indexerUri: "https://indexer.midnight.network/api/v1/graphql",
  indexerWsUri: "wss://indexer.midnight.network/api/v1/graphql/ws",
  defaultProverUri: null, // Prover must be explicitly configured for Mainnet
  defaultContractAddress: null, // Contract address set only upon formal verified deployment
  currencySymbol: "DUST",
  faucetAvailable: false,
});

export const ENVIRONMENT_REGISTRY: Readonly<Record<PactraEnvironmentId, NetworkEnvironmentProfile>> = Object.freeze({
  LOCAL: LOCAL_ENVIRONMENT,
  PREPROD: PREPROD_ENVIRONMENT,
  MAINNET: MAINNET_ENVIRONMENT,
});

export function getEnvironmentProfile(env: PactraEnvironmentId): NetworkEnvironmentProfile {
  const profile = ENVIRONMENT_REGISTRY[env];
  if (!profile) {
    throw new Error(`Unknown Pactra environment: "${env}". Expected LOCAL, PREPROD, or MAINNET.`);
  }
  return profile;
}
