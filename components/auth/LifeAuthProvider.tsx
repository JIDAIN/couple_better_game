"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LifeIdentity } from "@/lib/server/life-auth";

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  identity: LifeIdentity | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const LifeAuthContext = createContext<AuthState | null>(null);

export function LifeAuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<LifeIdentity | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const result = (await response.json()) as { authenticated?: boolean; identity?: LifeIdentity | null };
      setIdentity(result.authenticated ? result.identity ?? null : null);
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    setIdentity(null);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 40 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const value = useMemo<AuthState>(() => ({
    loading,
    authenticated: Boolean(identity),
    identity,
    refresh,
    logout,
  }), [identity, loading, logout, refresh]);

  return <LifeAuthContext.Provider value={value}>{children}</LifeAuthContext.Provider>;
}

export function useLifeAuth() {
  const value = useContext(LifeAuthContext);
  if (!value) throw new Error("useLifeAuth must be used inside LifeAuthProvider");
  return value;
}
