import { describe, expect, it, vi } from "vitest";
import { raceHarborWorkerAndLedger } from "../../lib/server/drive-bridge-kick-race";

describe("Harbor ledger-first wake race", () => {
  it("returns immediately from the ledger when a finalized receipt appears first", async () => {
    let clock = 0;
    let reads = 0;
    const abortWorker = vi.fn();
    const worker = new Promise<string>(() => {});

    const result = await raceHarborWorkerAndLedger({
      worker,
      readLedger: async () => {
        reads += 1;
        return reads >= 2 ? { status: "succeeded" as const } : null;
      },
      abortWorker,
      maxLedgerWaitMs: 2_000,
      pollIntervalMs: 250,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });

    expect(result).toEqual({ kind: "ledger", ledger: { status: "succeeded" } });
    expect(reads).toBe(2);
    expect(abortWorker).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting when the ledger is only processing", async () => {
    let clock = 0;
    const abortWorker = vi.fn();
    let resolveWorker!: (value: string) => void;
    const worker = new Promise<string>((resolve) => {
      resolveWorker = resolve;
    });

    const promise = raceHarborWorkerAndLedger({
      worker,
      readLedger: async () => null,
      abortWorker,
      maxLedgerWaitMs: 500,
      pollIntervalMs: 250,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });

    resolveWorker("worker-finished");
    await expect(promise).resolves.toEqual({ kind: "worker", worker: "worker-finished" });
    expect(abortWorker).not.toHaveBeenCalled();
  });

  it("returns worker errors without claiming ledger success", async () => {
    const error = new Error("wake failed");
    const abortWorker = vi.fn();

    const result = await raceHarborWorkerAndLedger({
      worker: Promise.reject(error),
      readLedger: async () => null,
      abortWorker,
    });

    expect(result).toEqual({ kind: "worker-error", error });
    expect(abortWorker).not.toHaveBeenCalled();
  });
});
