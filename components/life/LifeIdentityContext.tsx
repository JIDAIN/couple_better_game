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
import { fetchLifeMonth, fetchLifeMonthBundle } from "@/lib/life/life-client";
import { hydrateLifeMonthBundle } from "@/lib/life/month-bundle";
import { fetchLifeSettings } from "@/lib/life/settings-client";
import { fetchWeights } from "@/lib/life/weight-client";
import { fetchMedicines } from "@/lib/life/medicine-client";
import { fetchMailboxLetters } from "@/lib/life/mailbox-client";
import { preloadMealPhotos } from "@/lib/nutrition/meal-photo-cache";
import type { MealRecord } from "@/lib/nutrition/meal-service";

export type LifeRelativeIdentity = {
  currentPartnerKey: LifePartnerKey | null;
  mePartnerKey: LifePartnerKey | null;
  taPartnerKey: LifePartnerKey | null;
  authenticated: boolean;
  loading: boolean;
  bootstrapReady: boolean;
  refreshIdentity: () => Promise<LifePartnerKey | null>;
};

const LifeIdentityContext = createContext<LifeRelativeIdentity>({
  currentPartnerKey: null,
  mePartnerKey: null,
  taPartnerKey: null,
  authenticated: false,
  loading: true,
  bootstrapReady: false,
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

async function preloadTodayMealPhotos(me: LifePartnerKey, ta: LifePartnerKey, date: string) {
  const meals = [
    ...(peekStaleQuery<MealRecord[]>(`meals:${me}:${date}`) ?? []),
    ...(peekStaleQuery<MealRecord[]>(`meals:${ta}:${date}`) ?? []),
  ];
  await preloadMealPhotos(meals, 1400);
}

async function warmLifeEssentials(me: LifePartnerKey) {
  const date = localDate();
  const month = date.slice(0, 7);
  const ta = oppositePartnerKey(me);

  for (const src of CORE_IMAGE_ASSETS) preloadStaticImage(src);

  const monthBundleTask = prefetchStaleQuery({
    key: `life-month-bundle:${month}`,
    fetcher: () => fetchLifeMonthBundle(month),
    staleMs: 60_000,
  }).then((bundle) => {
    hydrateLifeMonthBundle(bundle, me, ta);
    return bundle;
  });

  void Promise.allSettled([
    monthBundleTask.then(() => preloadTodayMealPhotos(me, ta, date)),
    prefetchStaleQuery({ key: `life-month:${month}`, fetcher: () => fetchLifeMonth(month), staleMs: 60_000 }),
    prefetchStaleQuery({ key: "life-settings", fetcher: fetchLifeSettings, staleMs: 60_000 }),
    prefetchStaleQuery({ key: `weights:${me}`, fetcher: () => fetchWeights(me) }),
    prefetchStaleQuery({ key: `weights:${ta}`, fetcher: () => fetchWeights(ta) }),
    prefetchStaleQuery({ key: "medicines", fetcher: fetchMedicines }),
    prefetchStaleQuery({ key: "mailbox", fetcher: fetchMailboxLetters }),
  ]);
}

function validPartner(value: unknown): value is LifePartnerKey {
  return value === "cat" || value === "fish";
}

export function LifeIdentityProvider({ children }: { children: ReactNode }) {
  const [partnerKey, setPartnerKey] = useState<LifePartnerKey | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bootstrapReady, setBootstrapReady] = useState(false);
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

  const finishInitialBootstrap = useCallback((next: LifePartnerKey | null) => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    setBootstrapReady(true);
    if (!next || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    void warmLifeEssentials(next).catch(() => undefined);
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
    finishInitialBootstrap(next);
    if (alreadyBootstrapped && next && (typeof navigator === "undefined" || navigator.onLine)) {
      void warmLifeEssentials(next).catch(() => undefined);
    }
    return next;
  }, [applyIdentity, finishInitialBootstrap]);

  useEffect(() => {
    const hint = readStaleQueryScopeHint();
    if (hint && !partnerRef.current) {
      applyIdentity(hint, false);
      finishInitialBootstrap(hint);
    }
    const task = window.setTimeout(() => { void refreshIdentity().catch(() => { setBootstrapReady(true); }); }, 0);
    const handleOnline = () => { void refreshIdentity().catch(() => undefined); };
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", handleOnline);
    };
  }, [applyIdentity, finishInitialBootstrap, refreshIdentity]);

  const value = useMemo<LifeRelativeIdentity>(() => ({
    currentPartnerKey: partnerKey,
    mePartnerKey: partnerKey,
    taPartnerKey: partnerKey ? oppositePartnerKey(partnerKey) : null,
    authenticated,
    loading,
    bootstrapReady,
    refreshIdentity,
  }), [authenticated, bootstrapReady, loading, partnerKey, refreshIdentity]);

  return <LifeIdentityContext.Provider value={value}>{children}</LifeIdentityContext.Provider>;
}

export function useLifeIdentity() {
  return useContext(LifeIdentityContext);
}
