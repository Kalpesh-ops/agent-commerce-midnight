/**
 * Pactra — Midnight Proof Server Adapter
 *
 * Provides a typed, fault-tolerant interface for Midnight Proof Server infrastructure.
 *
 * ANTI-FABRICATION GUARANTEE:
 * If an external Midnight Proof Server is not deployed or reachable in the active
 * environment, this adapter reports explicit "NOT_CONFIGURED" or "OFFLINE" states.
 * It NEVER returns simulated proofs disguised as real cryptographic attestations.
 */

export type ProofServerHealthStatus = "ONLINE" | "DEGRADED" | "OFFLINE" | "NOT_CONFIGURED";

export interface ProofServerConfig {
  readonly proverServerUri?: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly healthCheckEndpoint?: string;
}

export interface ProofServerHealthReport {
  readonly status: ProofServerHealthStatus;
  readonly proverUri: string | null;
  readonly latencyMs: number | null;
  readonly isConfigured: boolean;
  readonly lastCheckedAt: number;
  readonly details: string;
}

export class MidnightProofServerAdapter {
  private readonly config: ProofServerConfig;

  constructor(config?: Partial<ProofServerConfig>) {
    this.config = {
      proverServerUri: config?.proverServerUri,
      timeoutMs: config?.timeoutMs ?? 5000,
      maxRetries: config?.maxRetries ?? 2,
      healthCheckEndpoint: config?.healthCheckEndpoint ?? "/health",
    };
  }

  /**
   * Return the active proof server configuration.
   * NEVER returns private keys or credentials.
   */
  public getConfig(): Omit<ProofServerConfig, "proverServerUri"> & { hasProverUri: boolean } {
    return {
      hasProverUri: Boolean(this.config.proverServerUri),
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      healthCheckEndpoint: this.config.healthCheckEndpoint,
    };
  }

  /**
   * Checks the health and responsiveness of the configured Midnight Proof Server.
   * Returns explicit NOT_CONFIGURED if no URI was provided.
   */
  public async checkHealth(): Promise<ProofServerHealthReport> {
    const proverUri = this.config.proverServerUri?.trim();

    if (!proverUri) {
      return {
        status: "NOT_CONFIGURED",
        proverUri: null,
        latencyMs: null,
        isConfigured: false,
        lastCheckedAt: Date.now(),
        details: "Midnight Proof Server URI is not configured. External proof generation requires configuring a prover daemon endpoint.",
      };
    }

    const healthUrl = `${proverUri.replace(/\/$/, "")}${this.config.healthCheckEndpoint}`;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(healthUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (response.ok) {
          return {
            status: "ONLINE",
            proverUri,
            latencyMs: latency,
            isConfigured: true,
            lastCheckedAt: Date.now(),
            details: `Midnight Proof Server is online and responsive (HTTP ${response.status} in ${latency}ms).`,
          };
        } else {
          return {
            status: "DEGRADED",
            proverUri,
            latencyMs: latency,
            isConfigured: true,
            lastCheckedAt: Date.now(),
            details: `Midnight Proof Server responded with non-success status: HTTP ${response.status} ${response.statusText}.`,
          };
        }
      } catch (err: any) {
        if (attempt === this.config.maxRetries) {
          const isTimeout = err.name === "AbortError" || err.message?.includes("aborted");
          return {
            status: "OFFLINE",
            proverUri,
            latencyMs: null,
            isConfigured: true,
            lastCheckedAt: Date.now(),
            details: isTimeout
              ? `Midnight Proof Server health check timed out after ${this.config.timeoutMs}ms.`
              : `Midnight Proof Server connection failed: ${err.message}`,
          };
        }
      }
    }

    return {
      status: "OFFLINE",
      proverUri,
      latencyMs: null,
      isConfigured: true,
      lastCheckedAt: Date.now(),
      details: "Midnight Proof Server is unreachable after maximum retry attempts.",
    };
  }
}
