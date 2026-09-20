/**
 * Midnight DApp Connector Types
 * Compliant with Midnight DApp Connector API v4.x and Midnight Lace Wallet.
 */

export type MidnightNetworkId = "preprod" | "preview" | "undeployed";

export interface MidnightConnectedAPI {
  getConnectionStatus(): Promise<{
    isConnected: boolean;
    networkId: string;
  }>;
  getShieldedAddresses(): Promise<{
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getConfiguration(): Promise<{
    proverServerUri?: string;
    indexerUri: string;
    indexerWsUri: string;
    nodeUri?: string;
  }>;
  balanceUnsealedTransaction(txHex: string): Promise<{ tx: string }>;
  submitTransaction(txHex: string): Promise<string>;
}

export interface MidnightInitialAPI {
  apiVersion: string;
  name: string;
  icon: string;
  connect(networkId: string): Promise<MidnightConnectedAPI>;
  isEnabled(networkId: string): Promise<boolean>;
}

declare global {
  interface Window {
    midnight?: Record<string, MidnightInitialAPI>;
  }
}
