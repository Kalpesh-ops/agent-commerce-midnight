/**
 * Pactra UI — Network Environment Configuration & Isolation
 */

export type UiEnvironmentId = "LOCAL" | "PREPROD" | "MAINNET";

export interface UiEnvironmentConfig {
  readonly id: UiEnvironmentId;
  readonly label: string;
  readonly badgeText: string;
  readonly color: string;
  readonly isProduction: boolean;
  readonly currency: string;
  readonly defaultContractAddress: string;
  readonly indexerUrl: string;
}

export const UI_ENVIRONMENTS: Record<UiEnvironmentId, UiEnvironmentConfig> = {
  PREPROD: {
    id: "PREPROD",
    label: "Midnight Preprod Testnet",
    badgeText: "PREPROD TESTNET",
    color: "#a855f7", // purple
    isProduction: false,
    currency: "tDUST",
    defaultContractAddress: "0200021c172da6a603bf236166ebfc00e3185392fe8890731fc612140bb0d970923f",
    indexerUrl: "https://indexer.preprod.midnight.network/api/v4/graphql",
  },
  MAINNET: {
    id: "MAINNET",
    label: "Midnight Mainnet (Production)",
    badgeText: "MAINNET PRODUCTION",
    color: "#10b981", // emerald
    isProduction: true,
    currency: "DUST",
    defaultContractAddress: "UNCONFIGURED_MAINNET_ADDRESS",
    indexerUrl: "https://indexer.midnight.network/api/v1/graphql",
  },
  LOCAL: {
    id: "LOCAL",
    label: "Local Devnet / Sandbox",
    badgeText: "LOCAL SANDBOX",
    color: "#3b82f6", // blue
    isProduction: false,
    currency: "tDUST",
    defaultContractAddress: "local_dev_contract_0000000000000000000000000000000000000000",
    indexerUrl: "http://localhost:8088/api/v1/graphql",
  },
};

const STORAGE_KEY = "pactra_active_environment_v1";

export function getActiveUiEnvironment(): UiEnvironmentConfig {
  const saved = localStorage.getItem(STORAGE_KEY) as UiEnvironmentId | null;
  if (saved && UI_ENVIRONMENTS[saved]) {
    return UI_ENVIRONMENTS[saved];
  }
  return UI_ENVIRONMENTS.PREPROD;
}

export function setActiveUiEnvironment(env: UiEnvironmentId): void {
  localStorage.setItem(STORAGE_KEY, env);
}
