"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LifePartnerKey } from "@/lib/life/life-service";
import { clearStaleQueries, prefetchStaleQuery } from "@/lib/client/use-stale-query";
import { fetchLifeDay, fetchLifeMonth } from "@/lib/life/life-client";
import { fetchWeights } from "@/lib/life/weight-client";
import { fetchMedicines } from "@/lib/life/medicine-client";
import { fetchMailboxLetters } from "@/lib/life/mailbox-client";
import { fetchMeals } from "@/lib/nutrition/meal-client";

export type LifeRelativeIdentity = {
  currentPartnerKey: LifePartnerKey | null;
  mePartnerKey: LifePartnerKey | null;
  taPartnerKey: LifePartnerKey | null;
  authenticated: boolean;
  loading: boolean;
  refreshIdentity: () => Promise<LifePartnerKey | null>;
};

const LifeIdentityContext = createContext<LifeRelativeIdentity>({
  currentPartnerKey: null,
  mePartnerKey: null,
  taPartnerKey: null,
  authenticated: false,
  loading: true,
  refreshIdentity: async () => null,
});

export function oppositePartnerKey(key: LifePartnerKey): LifePartnerKey {
  return key === "cat" ? "fish" : "cat";
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function warmLifeData(me: LifePartnerKey) {
  const date = localDate();
  const month = date.slice(0, 7);
  const ta = oppositePartnerKey(me);
  const tasks = [
    prefetchStaleQuery({ key: `life-day:${date}`, fetcher: () => fetchLifeDay(date), staleMs: 20_000 }),
    prefetchStaleQuery({ key: `life-month:${month}`, fetcher: () => fetchLifeMonth(month), staleMs: 60_000 }),
    prefetchStaleQuery({ key: `meals:${me}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: me })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
    prefetchStaleQuery({ key: `meals:${ta}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: ta })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
    prefetchStaleQuery({ key: `weights:${me}`, fetcher: () => fetchWeights(me) }),
    prefetchStaleQuery({ key: `weights:${ta}`, fetcher: () => fetchWeights(ta) }),
    prefetchStaleQuery({ key: "medicines", fetcher: fetchMedicines }),
    prefetchStaleQuery({ key: "mailbox", fetcher: fetchMailboxLetters }),
  ];
  await Promise.allSettled(tasks);
}

export function LifeIdentityProvider({ children }: { children: ReactNode }) {
  const [partnerKey, setPartnerKey] = useState<LifePartnerKey | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const partnerRef = useRef<LifePartnerKey | null>(null);

  const refreshIdentity = useCallback(async () => {
    setLoading(true);
    let next: LifePartnerKey | null = null;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error("读取登录状态失败");
      const data = (await response.json()) as { authenticated?: boolean; identity?: { partnerKey?: LifePartnerKey } };
      next = data.authenticated && (data.identity?.partnerKey === "cat" || data.identity?.partnerKey === "fish") ? data.identity.partnerKey : null;
    } catch {
      next = null;
    } finally {
      if (partnerRef.current !== next) clearStaleQueries();
      partnerRef.current = next;
      setPartnerKey(next);
      setAuthenticated(Boolean(next));
      setLoading(false);
    }
    if (next) await warmLifeData(next);
    return next;
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => { void refreshIdentity().catch(() => undefined); }, 0);
    return () => window.clearTimeout(task);
  }, [refreshIdentity]);

  const value = useMemo<LifeRelativeIdentity>(() => ({
    currentPartnerKey: partnerKey,
    mePartnerKey: partnerKey,
    taPartnerKey: partnerKey ? oppositePartnerKey(partnerKey) : null,
    authenticated,
    loading,
    refreshIdentity,
  }), [authenticated, loading, partnerKey, refreshIdentity]);

  return <LifeIdentityContext.Provider value={value}>{children}</LifeIdentityContext.Provider>;
}

export function useLifeIdentity() {
  return useContext(LifeIdentityContext);
}
