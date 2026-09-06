import { describe, expect, it } from "vitest";

import {
  assertIsolatedLifeImportPayload,
  assertIslandLifeMaintenanceTables,
  classifyCoupleDataTable,
} from "../../lib/server/life-data-domains";

describe("Island Life / Legacy Game data boundary", () => {
  it("classifies current life and legacy game tables separately", () => {
    expect(classifyCoupleDataTable("meals")).toBe("island_life");
    expect(classifyCoupleDataTable("medicine_items")).toBe("island_life");
    expect(classifyCoupleDataTable("wallets")).toBe("legacy_game");
    expect(classifyCoupleDataTable("daily_records")).toBe("legacy_game");
    expect(classifyCoupleDataTable("partner_profiles")).toBe("shared_system");
  });

  it("blocks legacy game tables from generic life maintenance", () => {
    expect(() => assertIslandLifeMaintenanceTables(["meals", "mood_entries"])).not.toThrow();
    expect(() => assertIslandLifeMaintenanceTables(["meals", "wallet_ledger"])).toThrow(
      "Legacy Game tables",
    );
  });

  it("rejects mixed Life imports that contain legacy game payloads", () => {
    expect(() =>
      assertIsolatedLifeImportPayload({
        schemaVersion: 1,
        user: { meals: [], medicine_items: [] },
      }),
    ).not.toThrow();

    expect(() =>
      assertIsolatedLifeImportPayload({
        schemaVersion: 1,
        user: { meals: [], daily_records: [] },
      }),
    ).toThrow("Legacy Game data");

    expect(() =>
      assertIsolatedLifeImportPayload({
        schemaVersion: 1,
        wallet: { gems: 0, coins: 21 },
      }),
    ).toThrow("Legacy Game data");
  });
});
