import { describe, it, expect, vi, beforeEach } from "vitest";
import { MidnightProofServerAdapter } from "../pactra/proof/proofServerAdapter.js";

describe("Midnight Proof Server Adapter & Infrastructure Boundaries", () => {
  it("reports NOT_CONFIGURED when no proverServerUri is specified", async () => {
    const adapter = new MidnightProofServerAdapter();
    const report = await adapter.checkHealth();

    expect(report.status).toBe("NOT_CONFIGURED");
    expect(report.isConfigured).toBe(false);
    expect(report.proverUri).toBeNull();
    expect(report.details).toContain("not configured");
  });

  it("never exposes sensitive keys or credentials in public config", () => {
    const adapter = new MidnightProofServerAdapter({
      proverServerUri: "https://prover.preprod.midnight.network",
      timeoutMs: 3000,
    });

    const config = adapter.getConfig();
    expect(config.hasProverUri).toBe(true);
    expect((config as any).proverServerUri).toBeUndefined();
    expect(config.timeoutMs).toBe(3000);
  });

  it("reports ONLINE when endpoint responds with HTTP 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new MidnightProofServerAdapter({
      proverServerUri: "https://mock-prover.local",
      healthCheckEndpoint: "/health",
      timeoutMs: 1000,
    });

    const report = await adapter.checkHealth();
    expect(report.status).toBe("ONLINE");
    expect(report.isConfigured).toBe(true);
    expect(report.proverUri).toBe("https://mock-prover.local");
    expect(report.latencyMs).toBeGreaterThanOrEqual(0);

    vi.unstubAllGlobals();
  });

  it("reports DEGRADED when endpoint responds with non-200 status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new MidnightProofServerAdapter({
      proverServerUri: "https://mock-prover.local",
      timeoutMs: 1000,
    });

    const report = await adapter.checkHealth();
    expect(report.status).toBe("DEGRADED");
    expect(report.details).toContain("503");

    vi.unstubAllGlobals();
  });

  it("reports OFFLINE when connection fails or times out", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:6300"));
    vi.stubGlobal("fetch", mockFetch);

    const adapter = new MidnightProofServerAdapter({
      proverServerUri: "http://127.0.0.1:6300",
      timeoutMs: 100,
      maxRetries: 1,
    });

    const report = await adapter.checkHealth();
    expect(report.status).toBe("OFFLINE");
    expect(report.details).toContain("ECONNREFUSED");

    vi.unstubAllGlobals();
  });
});
