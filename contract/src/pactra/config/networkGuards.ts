/**
 * Pactra — Network Isolation & Safety Guards
 *
 * Prevents accidental cross-network execution, silent fallback to testnet,
 * and mismatched wallet connections.
 */

import { PactraEnvironmentId, getEnvironmentProfile } from "./environments.js";

export class NetworkMismatchError extends Error {
  constructor(
    public readonly configuredEnv: PactraEnvironmentId,
    public readonly detectedNetwork: string,
    message: string
  ) {
    super(message);
    this.name = "NetworkMismatchError";
  }
}

export class ProductionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionGuardError";
  }
}

export class NetworkGuards {
  /**
   * Asserts that the connected wallet's network matches the application's configured environment.
   */
  public static validateNetworkMatch(
    configuredEnv: PactraEnvironmentId,
    walletNetwork: string
  ): void {
    const profile = getEnvironmentProfile(configuredEnv);
    const normalizedWallet = walletNetwork.toLowerCase().trim();

    if (configuredEnv === "MAINNET") {
      if (normalizedWallet !== "mainnet" && normalizedWallet !== "production") {
        throw new NetworkMismatchError(
          configuredEnv,
          walletNetwork,
          `CRITICAL NETWORK MISMATCH: DApp is configured for ${profile.networkName}, but connected Lace wallet is on "${walletNetwork}". Switch your wallet to Midnight Mainnet.`
        );
      }
    } else if (configuredEnv === "PREPROD") {
      if (normalizedWallet !== "testnet" && normalizedWallet !== "preprod") {
        throw new NetworkMismatchError(
          configuredEnv,
          walletNetwork,
          `NETWORK MISMATCH: DApp is configured for ${profile.networkName}, but connected Lace wallet is on "${walletNetwork}". Switch your wallet to Midnight Preprod.`
        );
      }
    } else if (configuredEnv === "LOCAL") {
      if (normalizedWallet !== "undeployed" && normalizedWallet !== "local" && normalizedWallet !== "devnet") {
        throw new NetworkMismatchError(
          configuredEnv,
          walletNetwork,
          `NETWORK MISMATCH: Local sandbox requires undeployed or devnet network, got "${walletNetwork}".`
        );
      }
    }
  }

  /**
   * Asserts that Mainnet configuration does NOT silently fall back to Preprod endpoints.
   */
  public static assertNoSilentFallback(
    configuredEnv: PactraEnvironmentId,
    activeIndexerUri: string,
    activeContractAddress: string | null
  ): void {
    if (configuredEnv === "MAINNET") {
      if (activeIndexerUri.includes("preprod") || activeIndexerUri.includes("testnet")) {
        throw new ProductionGuardError(
          "FATAL: Mainnet environment is referencing a Preprod indexer URL! Silent fallback to testnet is strictly prohibited."
        );
      }

      if (!activeContractAddress) {
        throw new ProductionGuardError(
          "Mainnet contract address is not configured. Mainnet execution requires a formally verified deployed contract."
        );
      }

      if (activeContractAddress === getEnvironmentProfile("PREPROD").defaultContractAddress) {
        throw new ProductionGuardError(
          "FATAL: Mainnet configuration is attempting to use the Preprod contract address! Cross-network contract reuse is strictly prohibited."
        );
      }
    }
  }

  /**
   * Verifies contract address format (hex-encoded 32-byte or 35-byte contract identifier).
   */
  public static validateContractAddress(address: string): { isValid: boolean; error?: string } {
    if (!address || typeof address !== "string") {
      return { isValid: false, error: "Contract address cannot be empty." };
    }

    const trimmed = address.trim();
    const hexPattern = /^(0x)?[0-9a-fA-F]{64,70}$/;
    if (!hexPattern.test(trimmed)) {
      return {
        isValid: false,
        error: `Invalid contract address format. Expected 64-70 character hex string, received length ${trimmed.length}.`,
      };
    }

    return { isValid: true };
  }

  /**
   * Enforces explicit manual user confirmation string before executing irreversible production operations.
   */
  public static assertProductionConfirmation(
    actionName: string,
    confirmationInput: string,
    requiredPhrase: string
  ): void {
    if (confirmationInput.trim() !== requiredPhrase.trim()) {
      throw new ProductionGuardError(
        `Production action "${actionName}" aborted. Expected explicit confirmation phrase "${requiredPhrase}", received "${confirmationInput}".`
      );
    }
  }
}
