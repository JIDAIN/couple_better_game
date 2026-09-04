"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LifePartnerKey } from "@/lib/life/life-service";
import {
  forgetStaleQueryScope,
  peekStaleQuery,
  prefetchStaleQuery,
  readStaleQueryScopeHint,
  rememberStaleQueryScope,
} from "@/lib/client/use-stale-query";
import { fetchLifeDay, fetchLifeMonthBundle } from "@/lib/life/life-client";
import { hydrateLifeMonthBundle } from "@/lib/life/month-bundle";
import { fetchLifeSettings } from "@/lib/life/settings-client";
import { fetchWeights } from "@/lib/life/weight-client";
import { fetchMedicines } from "@/lib/life/medicine-client";
import { fetchMailboxLetters } from "@/lib/life/mailbox-client";
import { preloadMealPhotos } from "@/lib/nutrition/meal-photo-cache";
import { fetchMeals } from "@/lib/nutrition/meal-client";
import type { MealRecord } from "@/lib/nutrition/meal-service";

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

const CORE_IMAGE_ASSETS = [
  "/illustrations/life/activity-girls.png",
  "/illustrations/life/mood-tired.png",
  "/illustrations/life/mood-angry.png",
  "/illustrations/life/mood-excited.png",
  "/illustrations/life/mood-annoyed.png",
  "/illustrations/life/mood-love.png",
  "/illustrations/life/mood-calm.png",
  "/illustrations/life/mood-sad.png",
  "/illustrations/life/mood-happy.png",
  "/illustrations/meals/breakfast.svg",
  "/illustrations/meals/lunch.svg",
  "/illustrations/meals/dinner.svg",
  "/illustrations/meals/snack.svg",
] as const;

function preloadStaticImage(src: string) {
  if (typeof window === "undefined") return;
  const image = new window.Image();
  image.decoding = "async";
  image.src = src;
}

function warmLifeEssentials(me: LifePartnerKey) {
  const date = localDate();
  const month = date.slice(0, 7);
  const ta = oppositePartnerKey(me);

  for (const src of CORE_IMAGE_ASSETS) preloadStaticImage(src);

  // Warm only canonical keys used by Today/Food first. Mounted screens reuse the
  // same promises, so opening the app no longer creates parallel duplicate reads.
  const essentialTasks = [
    prefetchStaleQuery({ key: `life-day:${date}`, fetcher: () => fetchLifeDay(date), staleMs: 20_000 }),
    prefetchStaleQuery({ key: `meals:${me}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: me })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
    prefetchStaleQuery({ key: `meals:${ta}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: ta })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
    prefetchStaleQuery({ key: "life-settings", fetcher: fetchLifeSettings, staleMs: 60_000 }),
  ];
  void Promise.allSettled(essentialTasks).then(() => {
    const meals = [
      ...(peekStaleQuery<MealRecord[]>(`meals:${me}:${date}`) ?? []),
      ...(peekStaleQuery<MealRecord[]>(`meals:${ta}:${date}`) ?? []),
    ];
    return preloadMealPhotos(meals, 1400);
  });

  // Month/detail and Nest datasets are useful prefetches, but must not compete
  // with the first visible screen. They start after the initial paint window.
  window.setTimeout(() => {
    void Promise.allSettled([
      prefetchStaleQuery({
        key: `life-month-bundle:${month}`,
        fetcher: () => fetchLifeMonthBundle(month),
        staleMs: 60_000,
      }).then((bundle) => hydrateLifeMonthBundle(bundle, me, ta)),
      prefetchStaleQuery({ key: `weights:${me}`, fetcher: () => fetchWeights(me) }),
      prefetchStaleQuery({ key: `weights:${ta}`, fetcher: () => fetchWeights(ta) }),
      prefetchStaleQuery({ key: "medicines", fetcher: fetchMedicines }),
      prefetchStaleQuery({ key: "mailbox", fetcher: fetchMailboxLetters }),
    ]);
  }, 1200);
}

function validPartner(value: unknown): value is LifePartnerKey {
  return value === "cat" || value === "fish";
}

export function LifeIdentityProvider({ children }: { children: ReactNode }) {
  const [partnerKey, setPartnerKey] = useState<LifePartnerKey | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const partnerRef = useRef<LifePartnerKey | null>(null);
  const bootstrappedRef = useRef(false);

  const applyIdentity = useCallback((next: LifePartnerKey | null, authoritative: boolean) => {
    partnerRef.current = next;
    setPartnerKey(next);
    setAuthenticated(Boolean(next));
    setLoading(false);
    if (authoritative) {
      if (next) rememberStaleQueryScope(next);
      else forgetStaleQueryScope();
    } else if (next) {
      rememberStaleQueryScope(next);
    }
  }, []);

  const startInitialWarmup = useCallback((next: LifePartnerKey | null) => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    if (!next || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    warmLifeEssentials(next);
  }, []);

  const refreshIdentity = useCallback(async () => {
    const fallback = partnerRef.current ?? readStaleQueryScopeHint();
    if (!fallback) setLoading(true);

    let next = fallback;
    let authoritative = false;
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (!response.ok) throw new Error("读取登录状态失败");
      const data = (await response.json()) as { authenticated?: boolean; identity?: { partnerKey?: LifePartnerKey } };
      next = data.authenticated && validPartner(data.identity?.partnerKey) ? data.identity.partnerKey : null;
      authoritative = true;
    } catch {
      next = fallback;
    }

    const alreadyBootstrapped = bootstrappedRef.current;
    applyIdentity(next, authoritative);
    startInitialWarmup(next);
    if (alreadyBootstrapped && next && (typeof navigator === "undefined" || navigator.onLine)) {
      warmLifeEssentials(next);
    }
    return next;
  }, [applyIdentity, startInitialWarmup]);

  useEffect(() => {
    const hint = readStaleQueryScopeHint();
    if (hint && !partnerRef.current) {
      applyIdentity(hint, false);
      startInitialWarmup(hint);
    }
    const task = window.setTimeout(() => { void refreshIdentity().catch(() => undefined); }, 0);
    const handleOnline = () => { void refreshIdentity().catch(() => undefined); };
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", handleOnline);
    };
  }, [applyIdentity, refreshIdentity, startInitialWarmup]);

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
