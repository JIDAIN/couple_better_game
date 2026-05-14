import { describe, expect, it } from "vitest";
import { createMemoryAppDataStore } from "../../lib/home/memory-app-data-store";
import type { AppDataSnapshot } from "../../lib/home/types";

const snapshot = (): AppDataSnapshot => ({
  version: 1,
  runtime: {
    wallet: { gems: 3, coins: 1 },
    dailyRecords: [],
    exchangeRecords: [],
  },
  config: {
    heatmapStartDate: "2026-05-06",
    exchangeCategories: [],
  },
});

describe("memory app data store", () => {
  it("returns null when empty", () => {
    const store = createMemoryAppDataStore();

    expect(store.load()).toBeNull();
  });

  it("saves and loads a snapshot", () => {
    const store = createMemoryAppDataStore();
    const data = snapshot();

    store.save(data);

    expect(store.load()).toEqual(data);
  });

  it("clears saved data", () => {
    const store = createMemoryAppDataStore(snapshot());

    store.clear?.();

    expect(store.load()).toBeNull();
  });

  it("does not share object references with callers", () => {
    const store = createMemoryAppDataStore();
    const data = snapshot();
    store.save(data);

    const loaded = store.load();
    expect(loaded).toEqual(data);
    expect(loaded).not.toBe(data);
    expect(loaded?.runtime.wallet).not.toBe(data.runtime.wallet);

    if (loaded?.runtime.wallet) {
      loaded.runtime.wallet.gems = 99;
    }

    expect(store.load()?.runtime.wallet?.gems).toBe(3);
  });
});
