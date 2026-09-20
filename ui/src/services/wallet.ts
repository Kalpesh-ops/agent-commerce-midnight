/**
 * Pactra — Midnight Lace Wallet Service
 *
 * Deterministic Connection State Machine:
 * DISCONNECTED -> DETECTING -> WALLET_DETECTED -> CONNECTING -> CONNECTED
 *                                             \-> FAILED / REJECTED / TIMEOUT
 */

import { MidnightConnectedAPI, MidnightInitialAPI, MidnightNetworkId } from "../types/midnight";

export type WalletConnectionStatus =
  | "DISCONNECTED"
  | "DETECTING"
  | "WALLET_DETECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "FAILED"
  | "REJECTED"
  | "TIMEOUT";

export type WalletErrorCode =
  | "WALLET_UNAVAILABLE"
  | "WALLET_LOCKED"
  | "USER_REJECTED"
  | "UNSUPPORTED_NETWORK"
  | "CONNECTOR_UNAVAILABLE"
  | "CONNECTION_TIMEOUT"
  | "UNKNOWN_ERROR";

export interface WalletState {
  status: WalletConnectionStatus;
  isInstalled: boolean;
  isConnected: boolean;
  networkId: MidnightNetworkId;
  detectedWalletName?: string;
  coinPublicKey?: string;
  encryptionPublicKey?: string;
  error?: string;
  errorCode?: WalletErrorCode;
  activeNetwork?: string;
}

type StateListener = (state: WalletState) => void;

export class MidnightWalletService {
  private state: WalletState = {
    status: "DETECTING",
    isInstalled: false,
    isConnected: false,
    networkId: "preprod",
  };

  private connectedAPI: MidnightConnectedAPI | null = null;
  private activeConnector: { id: string; api: MidnightInitialAPI } | null = null;
  private listeners = new Set<StateListener>();
  private detectionTimer: any = null;
  private detectionInterval: any = null;
  private healthCheckInterval: any = null;
  private activeConnectPromise: Promise<WalletState> | null = null;

  constructor() {
    this.startDetection();
  }

  public getState(): WalletState {
    return { ...this.state };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<WalletState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (err) {
        console.error("Error in wallet state listener:", err);
      }
    }
  }

  /**
   * Scans window.midnight for any injected Lace / Midnight connector API.
   */
  private inspectWindow(): { id: string; api: MidnightInitialAPI } | null {
    if (typeof window === "undefined") return null;
    const midnightObj = (window as any).midnight;
    if (midnightObj && typeof midnightObj === "object") {
      // 1. Direct Lace connector check
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

    // 3. Fallback check for cardano/midnight injected hooks
    if ((window as any).cardano?.midnight && typeof (window as any).cardano.midnight.connect === "function") {
      return { id: "cardano-midnight", api: (window as any).cardano.midnight };
    }

    return null;
  }

  /**
   * Deterministic detection on load: polls every 100ms up to 2500ms max.
   * Handles asynchronous extension injection without requiring multiple clicks.
   */
  public startDetection(): void {
    if (this.state.status === "CONNECTED" || this.state.status === "CONNECTING") {
      return;
    }

    this.cleanupDetection();
    this.updateState({ status: "DETECTING", error: undefined, errorCode: undefined });

    const found = this.inspectWindow();
    if (found) {
      this.activeConnector = found;
      this.updateState({
        status: "WALLET_DETECTED",
        isInstalled: true,
        detectedWalletName: found.api.name || found.id,
      });
      return;
    }

    const startTime = Date.now();
    this.detectionInterval = setInterval(() => {
      const candidate = this.inspectWindow();
      if (candidate) {
        this.cleanupDetection();
        this.activeConnector = candidate;
        this.updateState({
          status: "WALLET_DETECTED",
          isInstalled: true,
          detectedWalletName: candidate.api.name || candidate.id,
        });
      } else if (Date.now() - startTime >= 2500) {
        this.cleanupDetection();
        if (this.state.status === "DETECTING") {
          this.updateState({
            status: "DISCONNECTED",
            isInstalled: false,
            errorCode: "WALLET_UNAVAILABLE",
            error: "Midnight Lace wallet extension not detected. Ensure it is installed and active.",
          });
        }
      }
    }, 100);
  }

  private cleanupDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    if (this.detectionTimer) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
  }

  public isLaceInstalled(): boolean {
    return Boolean(this.activeConnector || this.inspectWindow());
  }

  /**
   * Initiates wallet connection.
   * Prevents duplicate connection attempts; ignores calls if already CONNECTING.
   */
  public async connect(networkId: MidnightNetworkId = "preprod"): Promise<WalletState> {
    // Prevent duplicate connection attempts
    if (this.state.status === "CONNECTING" && this.activeConnectPromise) {
      return this.activeConnectPromise;
    }

    this.activeConnectPromise = this.performConnect(networkId);
    try {
      return await this.activeConnectPromise;
    } finally {
      this.activeConnectPromise = null;
    }
  }

  private async performConnect(networkId: MidnightNetworkId): Promise<WalletState> {
    this.cleanupDetection();

    // Re-verify connector availability
    let connector = this.activeConnector || this.inspectWindow();
    if (!connector) {
      // Short grace period in case extension just finished loading
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 100));
        connector = this.inspectWindow();
        if (connector) break;
      }
    }

    if (!connector) {
      this.updateState({
        status: "FAILED",
        isConnected: false,
        isInstalled: false,
        networkId,
        errorCode: "WALLET_UNAVAILABLE",
        error: "Midnight Lace extension not found. Please install Midnight Lace and refresh the page.",
      });
      return this.getState();
    }

    this.activeConnector = connector;
    this.updateState({
      status: "CONNECTING",
      networkId,
      error: undefined,
      errorCode: undefined,
    });

    try {
      // Race api.connect against a 45-second user authorization timeout
      const connectPromise = (async () => {
        try {
          return await connector.api.connect(networkId);
        } catch (initialErr: any) {
          // Fallback if version doesn't take networkId
          if (typeof (connector.api as any).enable === "function") {
            return await (connector.api as any).enable();
          }
          throw initialErr;
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutErr: any = new Error("Connection request timed out awaiting user authorization in Lace.");
          timeoutErr.isTimeout = true;
          reject(timeoutErr);
        }, 45000);
      });

      const connected = (await Promise.race([connectPromise, timeoutPromise])) as MidnightConnectedAPI;
      if (!connected) {
        throw new Error("Lace returned an empty or invalid connected API.");
      }

      // Verify connection status from wallet
      let connectionStatus: any = null;
      try {
        if (typeof connected.getConnectionStatus === "function") {
          connectionStatus = await connected.getConnectionStatus();
        }
      } catch (e) {
        console.warn("Could not query getConnectionStatus:", e);
      }

      // Verify wallet configuration
      let config: any = null;
      try {
        if (typeof connected.getConfiguration === "function") {
          config = await connected.getConfiguration();
        }
      } catch (e) {
        console.warn("Could not query getConfiguration:", e);
      }

      // Verify network compatibility
      const activeNet = (connectionStatus?.networkId || config?.networkId || "").toLowerCase();
      if (networkId === "preprod" && activeNet && !activeNet.includes("preprod")) {
        const mismatchErr: any = new Error(
          `Lace is connected to "${activeNet}". Please switch network to Preprod in Lace Settings -> Network.`
        );
        mismatchErr.isNetworkMismatch = true;
        mismatchErr.detectedNetwork = activeNet;
        throw mismatchErr;
      }

      // Verify required wallet methods exist
      if (
        typeof connected.getShieldedAddresses !== "function" ||
        typeof connected.balanceUnsealedTransaction !== "function" ||
        typeof connected.submitTransaction !== "function"
      ) {
        const missingMethodErr: any = new Error(
          "Connected wallet is missing essential methods (getShieldedAddresses / balanceUnsealedTransaction)."
        );
        missingMethodErr.isMissingMethod = true;
        throw missingMethodErr;
      }

      // Fetch shielded public keys
      const addresses = await connected.getShieldedAddresses();
      if (!addresses || !addresses.shieldedCoinPublicKey) {
        throw new Error("Connected wallet returned empty shielded keys. Ensure your Lace wallet account is initialized.");
      }

      this.connectedAPI = connected;

      this.updateState({
        status: "CONNECTED",
        isInstalled: true,
        isConnected: true,
        networkId,
        activeNetwork: activeNet || networkId,
        detectedWalletName: connector.api.name || connector.id,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        error: undefined,
        errorCode: undefined,
      });

      // Start periodic health check
      this.startHealthCheck();

      return this.getState();
    } catch (err: any) {
      this.connectedAPI = null;
      const msg = err?.message || String(err);
      const lower = msg.toLowerCase();

      let status: WalletConnectionStatus = "FAILED";
      let errorCode: WalletErrorCode = "UNKNOWN_ERROR";
      let friendlyError = msg;

      if (err.isTimeout) {
        status = "TIMEOUT";
        errorCode = "CONNECTION_TIMEOUT";
        friendlyError = "Connection request timed out. Please unlock Lace and approve the connection prompt.";
      } else if (err.isNetworkMismatch) {
        status = "FAILED";
        errorCode = "UNSUPPORTED_NETWORK";
        friendlyError = msg;
      } else if (err.isMissingMethod) {
        status = "FAILED";
        errorCode = "CONNECTOR_UNAVAILABLE";
        friendlyError = msg;
      } else if (lower.includes("reject") || lower.includes("denied") || lower.includes("cancel") || lower.includes("decline")) {
        status = "REJECTED";
        errorCode = "USER_REJECTED";
        friendlyError = "Connection rejected by user in Lace popup.";
      } else if (lower.includes("lock") || lower.includes("passphrase")) {
        status = "FAILED";
        errorCode = "WALLET_LOCKED";
        friendlyError = "Midnight Lace is locked. Unlock your wallet extension and try again.";
      }

      this.updateState({
        status,
        isConnected: false,
        networkId,
        errorCode,
        error: friendlyError,
      });

      return this.getState();
    }
  }

  public disconnect(): void {
    this.cleanupHealthCheck();
    this.connectedAPI = null;
    this.updateState({
      status: this.activeConnector ? "WALLET_DETECTED" : "DISCONNECTED",
      isConnected: false,
      coinPublicKey: undefined,
      encryptionPublicKey: undefined,
      error: undefined,
      errorCode: undefined,
    });
  }

  private startHealthCheck(): void {
    this.cleanupHealthCheck();
    this.healthCheckInterval = setInterval(async () => {
      if (this.state.status !== "CONNECTED" || !this.connectedAPI) {
        this.cleanupHealthCheck();
        return;
      }

      try {
        if (typeof this.connectedAPI.getConnectionStatus === "function") {
          const status = await this.connectedAPI.getConnectionStatus();
          if (status && (status as any).status === "disconnected") {
            this.disconnect();
          }
        }
      } catch (err) {
        console.warn("Lace health check error:", err);
      }
    }, 5000);
  }

  private cleanupHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  public getConnectedAPI(): MidnightConnectedAPI | null {
    return this.connectedAPI;
  }

  public destroy(): void {
    this.cleanupDetection();
    this.cleanupHealthCheck();
    this.listeners.clear();
  }
}

export const walletService = new MidnightWalletService();
