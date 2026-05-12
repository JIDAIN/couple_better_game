"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { HeatmapDay } from "./types";

export const GEM_CAP = 50;

type Wallet = { gems: number; coins: number };

export type HeatmapDayOverrides = Partial<Record<number, HeatmapDay>>;

export type TodayRecordPayload = {
  /** 5 月日期 1–31 */
  day: number;
  fishHeat: HeatmapDay;
  catHeat: HeatmapDay;
  fishGems: number;
  catGems: number;
  bonusGems: number;
  coinDelta: number;
};

type HomeResourcesContextValue = {
  gemStock: number;
  coinStock: number;
  tryRedeem: (cost: { gems?: number; coins?: number }) => boolean;
  streakDays: number;
  todayFishGems: number;
  todayCatGems: number;
  weekGemTotal: number;
  weekCoinTotal: number;
  fishHeatmapOverrides: HeatmapDayOverrides;
  catHeatmapOverrides: HeatmapDayOverrides;
  applyTodayRecord: (payload: TodayRecordPayload) => void;
};

const HomeResourcesContext = createContext<HomeResourcesContextValue | null>(
  null,
);

export function useHomeResources() {
  const ctx = useContext(HomeResourcesContext);
  if (!ctx) {
    throw new Error("useHomeResources must be used within HomeResourcesProvider");
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  initialGems?: number;
  initialCoins?: number;
};

export function HomeResourcesProvider({
  children,
  initialGems = 0,
  initialCoins = 0,
}: ProviderProps) {
  const [wallet, setWallet] = useState<Wallet>({
    gems: initialGems,
    coins: initialCoins,
  });
  const [streakDays, setStreakDays] = useState(0);
  const [todayFishGems, setTodayFishGems] = useState(0);
  const [todayCatGems, setTodayCatGems] = useState(0);
  const [weekGemTotal, setWeekGemTotal] = useState(0);
  const [weekCoinTotal, setWeekCoinTotal] = useState(0);
  const [fishHeatmapOverrides, setFishHeatmapOverrides] =
    useState<HeatmapDayOverrides>({});
  const [catHeatmapOverrides, setCatHeatmapOverrides] =
    useState<HeatmapDayOverrides>({});

  const tryRedeem = useCallback((cost: { gems?: number; coins?: number }) => {
    const g = cost.gems ?? 0;
    const c = cost.coins ?? 0;
    let ok = false;
    setWallet((w) => {
      if (w.gems < g || w.coins < c) return w;
      ok = true;
      return { gems: w.gems - g, coins: w.coins - c };
    });
    return ok;
  }, []);

  const applyTodayRecord = useCallback((payload: TodayRecordPayload) => {
    const addGems =
      payload.fishGems + payload.catGems + payload.bonusGems;
    setWallet((w) => ({
      gems: Math.min(GEM_CAP, w.gems + addGems),
      coins: w.coins + payload.coinDelta,
    }));
    setTodayFishGems(payload.fishGems);
    setTodayCatGems(payload.catGems);
    setWeekGemTotal((v) => v + addGems);
    setWeekCoinTotal((v) => v + payload.coinDelta);
    setStreakDays((s) => s + 1);
    setFishHeatmapOverrides((o) => ({
      ...o,
      [payload.day]: payload.fishHeat,
    }));
    setCatHeatmapOverrides((o) => ({
      ...o,
      [payload.day]: payload.catHeat,
    }));
  }, []);

  const value = useMemo(
    () => ({
      gemStock: wallet.gems,
      coinStock: wallet.coins,
      tryRedeem,
      streakDays,
      todayFishGems,
      todayCatGems,
      weekGemTotal,
      weekCoinTotal,
      fishHeatmapOverrides,
      catHeatmapOverrides,
      applyTodayRecord,
    }),
    [
      wallet.gems,
      wallet.coins,
      tryRedeem,
      streakDays,
      todayFishGems,
      todayCatGems,
      weekGemTotal,
      weekCoinTotal,
      fishHeatmapOverrides,
      catHeatmapOverrides,
      applyTodayRecord,
    ],
  );

  return (
    <HomeResourcesContext.Provider value={value}>
      {children}
    </HomeResourcesContext.Provider>
  );
}
