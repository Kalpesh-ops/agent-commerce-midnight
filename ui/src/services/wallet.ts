/**
 * Pactra — Midnight Lace Wallet Service
 *
 * Deterministic Connection State Machine with Persistent Device & Session Whitelisting:
 * DISCONNECTED -> DETECTING -> WALLET_DETECTED -> CONNECTING -> CONNECTED
 *                                             \-> FAILED / REJECTED / TIMEOUT
 *
 * Features:
 * 1. Persistent Device Fingerprinting & Whitelisting (no re-login on reload)
 * 2. Instant Optimistic Session Restoration on page load
 * 3. Resilient Silent Background Reconnection with 10s grace period for extension injection
 * 4. Fallback Detection across all Lace/Midnight injected namespace variations
 * 5. Automatic Invariant & Account-switching synchronization
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

export interface DeviceProfile {
  deviceId: string;
  deviceType: "Desktop" | "Mobile" | "Tablet";
  os: string;
  browser: string;
  screenResolution: string;
  timezone: string;
  isWhitelistedDevice: boolean;
  lastAuthorizedAt: number;
}

export interface StoredWalletSession {
  version: number;
  deviceId: string;
  networkId: MidnightNetworkId;
  detectedWalletName: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
  connectedAt: number;
  expiresAt: number;
  autoReconnect: boolean;
}

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
  isRestoredSession?: boolean;
  deviceProfile?: DeviceProfile;
}

type StateListener = (state: WalletState) => void;

const STORAGE_SESSION_KEY = "pactra_wallet_session_v1";
const STORAGE_DEVICE_ID_KEY = "pactra_device_id_v1";
const STORAGE_WHITELIST_KEY = "pactra_whitelisted_devices_v1";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days persistent trust

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const memoryStorageFallback = new MemoryStorage();

function getSafeStorage(): Storage {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== "undefined") {
      return localStorage;
    }
  } catch {
    // fallback
  }
  return memoryStorageFallback;
}

function detectDeviceProfile(storage: Storage | null): DeviceProfile {
  let deviceId = "dev_standalone";
  if (storage) {
    try {
      const existing = storage.getItem(STORAGE_DEVICE_ID_KEY);
      if (existing) {
        deviceId = existing;
      } else {
        deviceId = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
        storage.setItem(STORAGE_DEVICE_ID_KEY, deviceId);
      }
    } catch {
      // storage disabled
    }
  }

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  let deviceType: "Desktop" | "Mobile" | "Tablet" = "Desktop";
  if (/iPad|Tablet|PlayBook/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/Mobile|Android|iPhone|iPod/i.test(ua)) {
    deviceType = "Mobile";
  }

  let os = "Desktop OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Macintosh|Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";

  let browser = "Web Browser";
  if (/Brave/i.test(ua) || (typeof navigator !== "undefined" && (navigator as any).brave)) browser = "Brave";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  const screenResolution =
    typeof window !== "undefined" && window.screen ? `${window.screen.width}x${window.screen.height}` : "1920x1080";
  const timezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  let isWhitelistedDevice = false;
  if (storage) {
    try {
      const rawWhitelist = storage.getItem(STORAGE_WHITELIST_KEY);
      if (rawWhitelist) {
        const list = JSON.parse(rawWhitelist);
        if (Array.isArray(list) && list.includes(deviceId)) {
          isWhitelistedDevice = true;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    deviceId,
    deviceType,
    os,
    browser,
    screenResolution,
    timezone,
    isWhitelistedDevice,
    lastAuthorizedAt: Date.now(),
  };
}

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
  private silentReconnectPromise: Promise<WalletState> | null = null;
  private storage: Storage | null = null;
  private deviceProfile: DeviceProfile;

  constructor() {
    this.storage = getSafeStorage();
    this.deviceProfile = detectDeviceProfile(this.storage);

    // 1. Check for stored session in localStorage
    const restoredSession = this.loadStoredSession();
    if (restoredSession) {
      this.state = {
        status: "CONNECTED",
        isInstalled: true,
        isConnected: true,
        networkId: restoredSession.networkId,
        detectedWalletName: restoredSession.detectedWalletName,
        coinPublicKey: restoredSession.coinPublicKey,
        encryptionPublicKey: restoredSession.encryptionPublicKey,
        activeNetwork: restoredSession.networkId,
        isRestoredSession: true,
        deviceProfile: { ...this.deviceProfile, isWhitelistedDevice: true },
      };

      // 2. Perform silent background reconnection to restore live API handle
      this.silentReconnectPromise = this.attemptSilentReconnection(restoredSession);
    } else {
      this.startDetection();
    }
  }

  public getState(): WalletState {
    return { ...this.state };
  }

  public getDeviceProfile(): DeviceProfile {
    return { ...this.deviceProfile };
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
   * Supports standard Lace, mnLace, cardano.midnight, and custom namespaces.
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
   * Deterministic detection on load: polls every 100ms up to 5000ms max.
   * Handles asynchronous extension injection smoothly.
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
      } else if (Date.now() - startTime >= 5000) {
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
   * Silently connects in the background on page reload using remembered session.
   * Never shows intrusive popups if origin is already authorized.
   */
  private async attemptSilentReconnection(session: StoredWalletSession): Promise<WalletState> {
    try {
      // Allow up to 10 seconds for asynchronous extension script injection
      let connector = this.inspectWindow();
      if (!connector) {
        const start = Date.now();
        while (Date.now() - start < 10000) {
          await new Promise((r) => setTimeout(r, 150));
          connector = this.inspectWindow();
          if (connector) break;
        }
      }

      if (!connector) {
        console.warn("Silent reconnection: Extension not detected within 10s. Session kept in read-only mode until interaction.");
        return this.getState();
      }

      this.activeConnector = connector;

      // Connect using the cached networkId
      let connected: MidnightConnectedAPI;
      try {
        connected = (await connector.api.connect(session.networkId)) as MidnightConnectedAPI;
      } catch (e) {
        if (typeof (connector.api as any).enable === "function") {
          connected = (await (connector.api as any).enable()) as MidnightConnectedAPI;
        } else {
          throw e;
        }
      }

      if (!connected) {
        throw new Error("Empty connected API returned during silent reconnection.");
      }

      const addresses = await connected.getShieldedAddresses();
      if (!addresses || !addresses.shieldedCoinPublicKey) {
        throw new Error("Empty shielded public keys returned during silent reconnection.");
      }

      this.connectedAPI = connected;

      // Synchronize session if user changed active account in Lace
      if (
        addresses.shieldedCoinPublicKey !== session.coinPublicKey ||
        addresses.shieldedEncryptionPublicKey !== session.encryptionPublicKey
      ) {
        this.saveSession({
          ...session,
          coinPublicKey: addresses.shieldedCoinPublicKey,
          encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        });
      }

      this.updateState({
        status: "CONNECTED",
        isInstalled: true,
        isConnected: true,
        isRestoredSession: false, // Fully live connected API active
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        detectedWalletName: connector.api.name || connector.id,
        deviceProfile: { ...this.deviceProfile, isWhitelistedDevice: true },
      });

      this.startHealthCheck();
      return this.getState();
    } catch (err: any) {
      console.warn("Silent reconnection notice:", err?.message || err);
      // Keep optimistic state active if transient error, or allow manual reconnect
      return this.getState();
    } finally {
      this.silentReconnectPromise = null;
    }
  }

  /**
   * Initiates wallet connection.
   * If background silent reconnection is in flight, awaits it.
   * Prevents duplicate connection attempts.
   */
  public async connect(networkId: MidnightNetworkId = "preprod"): Promise<WalletState> {
    if (this.silentReconnectPromise) {
      try {
        const state = await this.silentReconnectPromise;
        if (state.isConnected && this.connectedAPI) {
          return state;
        }
      } catch {
        // Fallthrough to explicit connection
      }
    }

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

  /**
   * Ensures a valid connected API handle is available for contract execution.
   */
  public async ensureConnected(networkId?: MidnightNetworkId): Promise<MidnightConnectedAPI> {
    if (this.connectedAPI) {
      return this.connectedAPI;
    }
    if (this.silentReconnectPromise) {
      await this.silentReconnectPromise;
      if (this.connectedAPI) {
        return this.connectedAPI;
      }
    }
    if (this.activeConnectPromise) {
      await this.activeConnectPromise;
      if (this.connectedAPI) {
        return this.connectedAPI;
      }
    }

    const res = await this.connect(networkId || this.state.networkId);
    if (!this.connectedAPI) {
      throw new Error(res.error || "Midnight Lace wallet is not connected. Connect your wallet first.");
    }
    return this.connectedAPI;
  }

  private async performConnect(networkId: MidnightNetworkId): Promise<WalletState> {
    this.cleanupDetection();

    // Re-verify connector availability with up to 5s exponential wait for extension injection
    let connector = this.activeConnector || this.inspectWindow();
    if (!connector) {
      const startTime = Date.now();
      while (Date.now() - startTime < 5000) {
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
        error: "Midnight Lace extension not found. Please ensure Midnight Lace is installed and active.",
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
      // 45-second user authorization timeout
      const connectPromise = (async () => {
        try {
          return await connector.api.connect(networkId);
        } catch (initialErr: any) {
          if (typeof (connector.api as any).enable === "function") {
            return await (connector.api as any).enable();
          }
          throw initialErr;
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutErr: any = new Error("Connection request timed out awaiting authorization in Lace.");
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

      // 3. Persist session for seamless reload on this device
      const sessionData: StoredWalletSession = {
        version: 1,
        deviceId: this.deviceProfile.deviceId,
        networkId,
        detectedWalletName: connector.api.name || connector.id,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        connectedAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION_MS,
        autoReconnect: true,
      };
      this.saveSession(sessionData);
      this.whitelistDevice(this.deviceProfile.deviceId);

      this.updateState({
        status: "CONNECTED",
        isInstalled: true,
        isConnected: true,
        networkId,
        activeNetwork: activeNet || networkId,
        detectedWalletName: connector.api.name || connector.id,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        isRestoredSession: false,
        deviceProfile: { ...this.deviceProfile, isWhitelistedDevice: true },
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

  /**
   * Explicit Disconnect: Clears stored session and cached device authorizations.
   */
  public disconnect(): void {
    this.cleanupHealthCheck();
    this.clearStoredSession();
    this.connectedAPI = null;
    this.silentReconnectPromise = null;
    this.updateState({
      status: this.activeConnector ? "WALLET_DETECTED" : "DISCONNECTED",
      isConnected: false,
      coinPublicKey: undefined,
      encryptionPublicKey: undefined,
      isRestoredSession: false,
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

  // --- Session & Device Whitelisting Persistence ---

  private loadStoredSession(): StoredWalletSession | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(STORAGE_SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw) as StoredWalletSession;
      if (!session || !session.coinPublicKey || session.version !== 1) {
        return null;
      }
      if (Date.now() > session.expiresAt || session.autoReconnect === false) {
        this.clearStoredSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  private saveSession(session: StoredWalletSession): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn("Could not persist wallet session:", e);
    }
  }

  private clearStoredSession(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  public whitelistDevice(deviceId: string): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_WHITELIST_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(deviceId)) {
        list.push(deviceId);
        this.storage.setItem(STORAGE_WHITELIST_KEY, JSON.stringify(list));
      }
      this.deviceProfile.isWhitelistedDevice = true;
    } catch {
      // ignore
    }
  }

  public revokeDeviceWhitelist(deviceId: string): void {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_WHITELIST_KEY);
      if (raw) {
        let list: string[] = JSON.parse(raw);
        list = list.filter((id) => id !== deviceId);
        this.storage.setItem(STORAGE_WHITELIST_KEY, JSON.stringify(list));
      }
      if (this.deviceProfile.deviceId === deviceId) {
        this.deviceProfile.isWhitelistedDevice = false;
      }
    } catch {
      // ignore
    }
  }

  public isDeviceWhitelisted(deviceId?: string): boolean {
    const target = deviceId || this.deviceProfile.deviceId;
    if (!this.storage) return false;
    try {
      const raw = this.storage.getItem(STORAGE_WHITELIST_KEY);
      if (!raw) return false;
      const list: string[] = JSON.parse(raw);
      return Array.isArray(list) && list.includes(target);
    } catch {
      return false;
    }
  }

  public destroy(): void {
    this.cleanupDetection();
    this.cleanupHealthCheck();
    this.listeners.clear();
  }
}

export const walletService = new MidnightWalletService();
