"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LifePartnerKey } from "@/lib/life/life-service";
import {
  forgetStaleQueryScope,
  prefetchStaleQuery,
  readStaleQueryScopeHint,
  rememberStaleQueryScope,
} from "@/lib/client/use-stale-query";
import { fetchLifeDay, fetchLifeMonth } from "@/lib/life/life-client";
import { fetchLifeSettings } from "@/lib/life/settings-client";
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
    prefetchStaleQuery({ key: "life-settings", fetcher: fetchLifeSettings, staleMs: 60_000 }),
  ];
  await Promise.allSettled(tasks);
}

function validPartner(value: unknown): value is LifePartnerKey {
  return value === "cat" || value === "fish";
}

export function LifeIdentityProvider({ children }: { children: ReactNode }) {
  const [partnerKey, setPartnerKey] = useState<LifePartnerKey | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const partnerRef = useRef<LifePartnerKey | null>(null);

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
      // A temporary network/5xx failure must not turn a confirmed cat/fish session into "logged out".
      // The server still validates every write; this fallback only keeps the local UI and cached reads usable.
      next = fallback;
    }

    applyIdentity(next, authoritative);
    if (next && (typeof navigator === "undefined" || navigator.onLine)) await warmLifeData(next);
    return next;
  }, [applyIdentity]);

  useEffect(() => {
    const hint = readStaleQueryScopeHint();
    if (hint && !partnerRef.current) applyIdentity(hint, false);
    const task = window.setTimeout(() => { void refreshIdentity().catch(() => undefined); }, 0);
    const handleOnline = () => { void refreshIdentity().catch(() => undefined); };
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(task);
      window.removeEventListener("online", handleOnline);
    };
  }, [applyIdentity, refreshIdentity]);

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
