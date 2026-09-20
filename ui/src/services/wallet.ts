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

  /**
   * Find any compatible Midnight DApp connector injected into window.midnight.
   * Handles asynchronous injection from Chrome/Brave/Edge extensions.
   */
  public async findWallet(timeoutMs = 2000): Promise<{ id: string; api: MidnightInitialAPI } | null> {
    if (typeof window === "undefined") return null;

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const midnightObj = (window as any).midnight;
      if (midnightObj && typeof midnightObj === "object") {
        // 1. Direct check for known Lace properties
        if (midnightObj.mnLace && typeof midnightObj.mnLace.connect === "function") {
          return { id: "mnLace", api: midnightObj.mnLace };
        }
        if (midnightObj.lace && typeof midnightObj.lace.connect === "function") {
          return { id: "lace", api: midnightObj.lace };
        }

        // 2. Scan all entries in window.midnight
        for (const [id, api] of Object.entries(midnightObj)) {
          if (api && typeof api === "object" && typeof (api as any).connect === "function") {
            return { id, api: api as MidnightInitialAPI };
          }
        }
      }

      // Check cardano/midnight injection fallbacks if present
      if ((window as any).cardano?.midnight) {
        const api = (window as any).cardano.midnight;
        if (typeof api.connect === "function") {
          return { id: "cardano-midnight", api };
        }
      }

      // Wait 100ms before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return null;
  }

  public isLaceInstalled(): boolean {
    if (typeof window === "undefined") return false;
    const midnightObj = (window as any).midnight;
    if (!midnightObj) return false;
    if (midnightObj.mnLace || midnightObj.lace) return true;
    return Object.values(midnightObj).some(
      (w: any) => w && typeof w === "object" && typeof w.connect === "function"
    );
  }

  public async connect(networkId: MidnightNetworkId = "preprod"): Promise<WalletState> {
    const walletEntry = await this.findWallet(2500);

    if (!walletEntry) {
      return {
        isInstalled: false,
        isConnected: false,
        networkId,
        error:
          "Midnight Lace wallet extension not detected. Ensure Midnight Lace is installed in your browser, unlocked, and enabled for http://localhost:3000.",
      };
    }

    try {
      const { id, api } = walletEntry;

      // Invoke wallet connect with network hint
      let connected: MidnightConnectedAPI;
      try {
        connected = await api.connect(networkId);
      } catch (connErr: any) {
        // Fallback: some extension versions do not accept networkId parameter
        if (typeof (api as any).enable === "function") {
          connected = await (api as any).enable();
        } else {
          throw connErr;
        }
      }

      this.connectedAPI = connected;

      let addresses = { shieldedCoinPublicKey: "", shieldedEncryptionPublicKey: "" };
      try {
        addresses = await connected.getShieldedAddresses();
      } catch (addrErr) {
        console.warn("Could not immediately read shielded addresses from wallet:", addrErr);
      }

      return {
        isInstalled: true,
        isConnected: true,
        networkId,
        walletName: api.name || id,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
      };
    } catch (err: any) {
      const msg = err?.message || String(err);
      let friendlyError = msg;
      if (msg.toLowerCase().includes("user reject") || msg.toLowerCase().includes("declined")) {
        friendlyError = "Connection rejected by user in Lace wallet popup.";
      } else if (msg.toLowerCase().includes("locked")) {
        friendlyError = "Lace wallet is locked. Please unlock your wallet extension and try again.";
      }

      return {
        isInstalled: true,
        isConnected: false,
        networkId,
        error: friendlyError,
      };
    }
  }

  public getConnectedAPI(): MidnightConnectedAPI | null {
    return this.connectedAPI;
  }
}

export const walletService = new MidnightWalletService();
