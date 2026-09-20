import { MidnightConnectedAPI, MidnightInitialAPI, MidnightNetworkId } from "../types/midnight";

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  networkId: MidnightNetworkId;
  walletName?: string;
  coinPublicKey?: string;
  encryptionPublicKey?: string;
  error?: string;
}

export class MidnightWalletService {
  private connectedAPI: MidnightConnectedAPI | null = null;

  public getAvailableWallets(): Array<{ id: string; api: MidnightInitialAPI }> {
    if (typeof window === "undefined" || !window.midnight) {
      return [];
    }
    return Object.entries(window.midnight).map(([id, api]) => ({ id, api }));
  }

  public isLaceInstalled(): boolean {
    return this.getAvailableWallets().length > 0;
  }

  public async connect(networkId: MidnightNetworkId = "preprod"): Promise<WalletState> {
    const wallets = this.getAvailableWallets();
    if (wallets.length === 0) {
      return {
        isInstalled: false,
        isConnected: false,
        networkId,
        error: "Midnight Lace wallet extension not detected in this browser.",
      };
    }

    try {
      // Pick the first available compatible Midnight connector (e.g. Lace)
      const { id, api } = wallets[0];
      const connected = await api.connect(networkId);
      this.connectedAPI = connected;

      const addresses = await connected.getShieldedAddresses();

      return {
        isInstalled: true,
        isConnected: true,
        networkId,
        walletName: api.name || id,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
      };
    } catch (err: any) {
      return {
        isInstalled: true,
        isConnected: false,
        networkId,
        error: err?.message || "Failed to authorize connection to Midnight wallet.",
      };
    }
  }

  public getConnectedAPI(): MidnightConnectedAPI | null {
    return this.connectedAPI;
  }
}

export const walletService = new MidnightWalletService();
