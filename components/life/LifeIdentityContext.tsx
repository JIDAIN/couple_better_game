"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LifePartnerKey } from "@/lib/life/life-service";

export type LifeRelativeIdentity = {
  currentPartnerKey: LifePartnerKey | null;
  mePartnerKey: LifePartnerKey | null;
  taPartnerKey: LifePartnerKey | null;
  authenticated: boolean;
  loading: boolean;
};

const LifeIdentityContext = createContext<LifeRelativeIdentity>({
  currentPartnerKey: null,
  mePartnerKey: null,
  taPartnerKey: null,
  authenticated: false,
  loading: true,
});

export function oppositePartnerKey(key: LifePartnerKey): LifePartnerKey {
  return key === "cat" ? "fish" : "cat";
}

export function LifeIdentityProvider({ children }: { children: ReactNode }) {
  const [partnerKey, setPartnerKey] = useState<LifePartnerKey | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          authenticated?: boolean;
          identity?: { partnerKey?: LifePartnerKey };
        };
        if (!active) return;
        const next = data.authenticated && (data.identity?.partnerKey === "cat" || data.identity?.partnerKey === "fish")
          ? data.identity.partnerKey
          : null;
        setPartnerKey(next);
        setAuthenticated(Boolean(next));
      })
      .catch(() => {
        if (!active) return;
        setPartnerKey(null);
        setAuthenticated(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<LifeRelativeIdentity>(() => ({
    currentPartnerKey: partnerKey,
    mePartnerKey: partnerKey,
    taPartnerKey: partnerKey ? oppositePartnerKey(partnerKey) : null,
    authenticated,
    loading,
  }), [authenticated, loading, partnerKey]);

  return <LifeIdentityContext.Provider value={value}>{children}</LifeIdentityContext.Provider>;
}

export function useLifeIdentity() {
  return useContext(LifeIdentityContext);
}
