import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { walletService } from "../services/wallet.js";

/**
 * Repeated clicks on "Connect wallet" must never open more than one Lace
 * authorization prompt at a time, whether the attempt ends in failure or not.
 */
describe("Wallet connect de-duplication", () => {
  const g = globalThis as any;
  let originalWindow: unknown;
  let laceConnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    walletService.disconnect();
    // Forget the connector cached by earlier tests so each test sees its own mock.
    (walletService as any).activeConnector = null;
    originalWindow = g.window;
    laceConnect = vi.fn(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("User rejected the request")), 20);
        })
    );
    g.window = { midnight: { mnLace: { name: "Lace", connect: laceConnect } } };
  });

  afterEach(() => {
    g.window = originalWindow;
    walletService.disconnect();
  });

  it("sends a single authorization request for many concurrent clicks", async () => {
    const results = await Promise.all([
      walletService.connect("preprod"),
      walletService.connect("preprod"),
      walletService.connect("preprod"),
      walletService.connect("preprod"),
    ]);

    expect(laceConnect).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.status).toBe("REJECTED");
      expect(r.isConnected).toBe(false);
    }
  });

  it("allows a fresh request once the previous attempt has settled", async () => {
    await walletService.connect("preprod");
    await walletService.connect("preprod");
    expect(laceConnect).toHaveBeenCalledTimes(2);
  });

  it("shares the attempt while it is still looking for the extension", async () => {
    g.window = { midnight: {} };
    const p1 = walletService.connect("preprod");
    const p2 = walletService.connect("preprod");
    expect(walletService.getState().status).toBe("DETECTING");

    // Extension appears mid-search; both callers must resolve from the same single request.
    g.window = { midnight: { mnLace: { name: "Lace", connect: laceConnect } } };
    const [a, b] = await Promise.all([p1, p2]);
    expect(laceConnect).toHaveBeenCalledTimes(1);
    expect(a.status).toBe(b.status);
  });
});

describe("Dispute idempotency", () => {
  it("refuses to dispute the same purchase twice, so the reservation is released once", async () => {
    const { pactraUiService } = await import("../services/pactraUiService.js");
    pactraUiService.resetAll();
    const record = await pactraUiService.procureComputeJob({
      jobId: "job_dispute_twice",
      serviceId: "srv_compute_alpha",
      instructions: "noop",
      maxDurationSeconds: 5,
    });
    const before = pactraUiService.getState().budgetSnapshot;
    pactraUiService.disputeProcurement(record.procurementId, "bad output");
    const afterFirst = pactraUiService.getState().budgetSnapshot;
    expect(() => pactraUiService.disputeProcurement(record.procurementId, "bad output")).toThrow(/already disputed/);
    expect(pactraUiService.getState().budgetSnapshot).toEqual(afterFirst);
    expect(afterFirst).not.toEqual(before);
  });
});
