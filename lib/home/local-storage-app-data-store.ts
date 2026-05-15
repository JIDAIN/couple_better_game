import {
  APP_DATA_STORAGE_KEY,
  isAppDataSnapshot,
  snapshotFromLegacyHomeState,
  type AppDataStore,
} from "./app-data-store";
import type { HomeResourcesState } from "./types";

export function createLocalStorageAppDataStore(
  storageKey = APP_DATA_STORAGE_KEY,
): AppDataStore {
  return {
    load() {
      if (typeof window === "undefined") return null;

      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as unknown;
      if (isAppDataSnapshot(parsed)) return parsed;
      return snapshotFromLegacyHomeState(parsed as Partial<HomeResourcesState>);
    },
    save(snapshot) {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
    },
    clear() {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(storageKey);
    },
  };
}
