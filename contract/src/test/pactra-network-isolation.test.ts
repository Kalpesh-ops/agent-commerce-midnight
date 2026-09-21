import { describe, it, expect } from "vitest";
import {
  NetworkGuards,
  NetworkMismatchError,
  ProductionGuardError,
} from "../pactra/config/networkGuards.js";
import {
  getEnvironmentProfile,
  LOCAL_ENVIRONMENT,
  PREPROD_ENVIRONMENT,
  MAINNET_ENVIRONMENT,
} from "../pactra/config/environments.js";

describe("Pactra Multi-Network Environment Isolation & Safety Guards", () => {
  it("enforces strict network profile properties and immutability", () => {
    expect(MAINNET_ENVIRONMENT.isProduction).toBe(true);
    expect(MAINNET_ENVIRONMENT.currencySymbol).toBe("DUST");
    expect(MAINNET_ENVIRONMENT.faucetAvailable).toBe(false);

    expect(PREPROD_ENVIRONMENT.isProduction).toBe(false);
    expect(PREPROD_ENVIRONMENT.currencySymbol).toBe("tDUST");
    expect(PREPROD_ENVIRONMENT.faucetAvailable).toBe(true);

    expect(LOCAL_ENVIRONMENT.networkId).toBe("undeployed");

    // Immutability check
    expect(() => {
      (MAINNET_ENVIRONMENT as any).currencySymbol = "FAKE";
    }).toThrow();
  });

  it("throws NetworkMismatchError when Mainnet DApp detects Preprod or testnet wallet", () => {
    expect(() => {
      NetworkGuards.validateNetworkMatch("MAINNET", "preprod");
    }).toThrow(NetworkMismatchError);

    expect(() => {
      NetworkGuards.validateNetworkMatch("MAINNET", "testnet");
    }).toThrow(NetworkMismatchError);
  });

  it("throws NetworkMismatchError when Preprod DApp detects Mainnet wallet", () => {
    expect(() => {
      NetworkGuards.validateNetworkMatch("PREPROD", "mainnet");
    }).toThrow(NetworkMismatchError);
  });

  it("approves valid matching wallet networks", () => {
    expect(() => NetworkGuards.validateNetworkMatch("MAINNET", "mainnet")).not.toThrow();
    expect(() => NetworkGuards.validateNetworkMatch("PREPROD", "preprod")).not.toThrow();
    expect(() => NetworkGuards.validateNetworkMatch("PREPROD", "testnet")).not.toThrow();
    expect(() => NetworkGuards.validateNetworkMatch("LOCAL", "undeployed")).not.toThrow();
  });

  it("strictly prevents silent fallback from Mainnet to Preprod indexer URL", () => {
    expect(() => {
      NetworkGuards.assertNoSilentFallback(
        "MAINNET",
        "https://indexer.preprod.midnight.network/api/v4/graphql",
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      );
    }).toThrow(ProductionGuardError);
  });

  it("strictly prohibits reusing the Preprod contract address in Mainnet", () => {
    const preprodAddress = PREPROD_ENVIRONMENT.defaultContractAddress!;
    expect(() => {
      NetworkGuards.assertNoSilentFallback(
        "MAINNET",
        "https://indexer.midnight.network/api/v1/graphql",
        preprodAddress
      );
    }).toThrow(ProductionGuardError);
  });

  it("validates contract address formatting", () => {
    const validHex = "0200021c172da6a603bf236166ebfc00e3185392fe8890731fc612140bb0d970923f";
    const invalidShort = "0x12345";
    const invalidChars = "0200021c172da6a603bf236166ebfc00e3185392fe8890731fc612140bb0d9ZZZZ";

    expect(NetworkGuards.validateContractAddress(validHex).isValid).toBe(true);
    expect(NetworkGuards.validateContractAddress(invalidShort).isValid).toBe(false);
    expect(NetworkGuards.validateContractAddress(invalidChars).isValid).toBe(false);
  });

  it("requires exact confirmation phrase before allowing irreversible production deployment", () => {
    expect(() => {
      NetworkGuards.assertProductionConfirmation(
        "DEPLOY_MAINNET",
        "yes",
        "DEPLOY PACTRA TO MIDNIGHT MAINNET"
      );
    }).toThrow(ProductionGuardError);

    expect(() => {
      NetworkGuards.assertProductionConfirmation(
        "DEPLOY_MAINNET",
        "DEPLOY PACTRA TO MIDNIGHT MAINNET",
        "DEPLOY PACTRA TO MIDNIGHT MAINNET"
      );
    }).not.toThrow();
  });
});
