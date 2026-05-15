import type { AppDataStore } from "./app-data-store";
import type { AppDataSnapshot } from "./types";

export function createMemoryAppDataStore(
  initialSnapshot: AppDataSnapshot | null = null,
): AppDataStore {
  let current = initialSnapshot;

  return {
    load() {
      return current ? structuredClone(current) : null;
    },
    save(snapshot) {
      current = structuredClone(snapshot);
    },
    clear() {
      current = null;
    },
  };
}
