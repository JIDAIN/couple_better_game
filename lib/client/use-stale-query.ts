"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CacheEntry<T> = { data?: T; updatedAt: number; promise?: Promise<T> };
type PersistedEntry = { data: unknown; updatedAt: number };
type PersistedCache = { version: 2; entries: Record<string, PersistedEntry> };

const queryCache = new Map<string, CacheEntry<unknown>>();
const CACHE_PREFIX = "couple-better-game:life-query:v2:";
const SCOPE_HINT_KEY = "couple-better-game:life-scope";
const MAX_PERSISTED_ENTRIES = 220;
const MAX_PERSISTED_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let activeScope: string | null = null;
let hydratedScope: string | null = null;

function browserReady() { return typeof window !== "undefined"; }
function validScope(value: string | null): value is "cat" | "fish" { return value === "cat" || value === "fish"; }
function storageKey(scope: string) { return `${CACHE_PREFIX}${scope}`; }
function shouldPersistKey(key: string) {
  return key.startsWith("life-day:")
    || key.startsWith("life-month:")
    || key.startsWith("life-month-bundle:")
    || key.startsWith("meals:")
    || key.startsWith("weights:")
    || key === "medicines"
    || key === "mailbox"
    || key === "life-settings";
}

export function readStaleQueryScopeHint() {
  if (!browserReady()) return null;
  try { const value = window.sessionStorage.getItem(SCOPE_HINT_KEY); return validScope(value) ? value : null; }
  catch { return null; }
}

function hydrateScope(scope: string) {
  if (!browserReady() || hydratedScope === scope) return;
  hydratedScope = scope;
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<PersistedCache> | null;
    if (!parsed || parsed.version !== 2 || !parsed.entries || typeof parsed.entries !== "object") return;
    const cutoff = Date.now() - MAX_PERSISTED_AGE_MS;
    for (const [key, entry] of Object.entries(parsed.entries)) {
      if (!shouldPersistKey(key) || !entry || typeof entry !== "object") continue;
      const candidate = entry as PersistedEntry;
      if (typeof candidate.updatedAt !== "number") continue;
      if (candidate.updatedAt > 0 && candidate.updatedAt < cutoff) continue;
      queryCache.set(key, { data: candidate.data, updatedAt: candidate.updatedAt });
    }
  } catch { /* cache is acceleration only */ }
}

function ensureScopeFromHint() {
  if (activeScope || !browserReady()) return;
  const hint = readStaleQueryScopeHint();
  if (!hint) return;
  activeScope = hint;
  hydrateScope(hint);
}

function persistCurrentScope() {
  if (!browserReady() || !activeScope) return;
  try {
    const cutoff = Date.now() - MAX_PERSISTED_AGE_MS;
    const entries = Array.from(queryCache.entries())
      .filter(([key, entry]) => shouldPersistKey(key) && entry.data !== undefined && (entry.updatedAt === 0 || entry.updatedAt >= cutoff))
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PERSISTED_ENTRIES);
    const payload: PersistedCache = { version: 2, entries: Object.fromEntries(entries.map(([key, entry]) => [key, { data: entry.data, updatedAt: entry.updatedAt }])) };
    window.localStorage.setItem(storageKey(activeScope), JSON.stringify(payload));
  } catch { /* storage restrictions/quota must not block the app */ }
}

export function setStaleQueryScope(scope: "cat" | "fish" | null) {
  if (activeScope === scope && hydratedScope === scope) return;
  activeScope = scope; hydratedScope = null; queryCache.clear(); if (scope) hydrateScope(scope);
}
export function rememberStaleQueryScope(scope: "cat" | "fish") {
  if (browserReady()) { try { window.sessionStorage.setItem(SCOPE_HINT_KEY, scope); } catch {} }
  setStaleQueryScope(scope);
}
export function forgetStaleQueryScope() {
  if (browserReady()) { try { window.sessionStorage.removeItem(SCOPE_HINT_KEY); } catch {} }
  setStaleQueryScope(null);
}
function entryFor<T>(key: string) { ensureScopeFromHint(); return queryCache.get(key) as CacheEntry<T> | undefined; }
export function peekStaleQuery<T>(key: string) { return entryFor<T>(key)?.data; }
export function setStaleQueryData<T>(key: string, data: T) { queryCache.set(key, { data, updatedAt: Date.now() }); persistCurrentScope(); }
export function setStaleQueryDataMany(entries: Array<{ key: string; data: unknown }>) {
  const updatedAt = Date.now(); for (const entry of entries) queryCache.set(entry.key, { data: entry.data, updatedAt }); persistCurrentScope();
}
export function invalidateStaleQuery(prefix: string) {
  for (const [key, entry] of queryCache.entries()) if (key.startsWith(prefix)) queryCache.set(key, { ...entry, updatedAt: 0 });
  persistCurrentScope();
}
export function clearStaleQueries({ persisted = false }: { persisted?: boolean } = {}) {
  ensureScopeFromHint(); queryCache.clear();
  if (persisted && browserReady() && activeScope) { try { window.localStorage.removeItem(storageKey(activeScope)); } catch {} }
}

export async function prefetchStaleQuery<T>({ key, fetcher, staleMs = 30_000 }: { key: string; fetcher: () => Promise<T>; staleMs?: number }): Promise<T> {
  const cached = entryFor<T>(key);
  const fresh = cached?.data !== undefined && Date.now() - cached.updatedAt < staleMs;
  if (fresh) return cached.data as T;
  if (cached?.promise) return cached.promise;
  const promise = fetcher();
  queryCache.set(key, { data: cached?.data, updatedAt: cached?.updatedAt ?? 0, promise });
  try {
    const data = await promise;
    queryCache.set(key, { data, updatedAt: Date.now() });
    persistCurrentScope();
    return data;
  } catch (cause) {
    queryCache.set(key, { data: cached?.data, updatedAt: cached?.updatedAt ?? 0 });
    throw cause;
  }
}

export function useStaleQuery<T>({ key, fetcher, staleMs = 30_000 }: { key: string; fetcher: () => Promise<T>; staleMs?: number }) {
  const initial = useMemo(() => peekStaleQuery<T>(key), [key]);
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(initial === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (force = false) => {
    const cached = entryFor<T>(key);
    const fresh = cached?.data !== undefined && Date.now() - cached.updatedAt < staleMs;
    if (!force && fresh) { setData(cached.data); setLoading(false); return cached.data; }
    setRefreshing(cached?.data !== undefined); if (cached?.data === undefined) setLoading(true);
    let promise = cached?.promise;
    if (!promise) { promise = fetcher(); queryCache.set(key, { data: cached?.data, updatedAt: cached?.updatedAt ?? 0, promise }); }
    try {
      const next = await promise;
      queryCache.set(key, { data: next, updatedAt: Date.now() }); persistCurrentScope(); setData(next); setError(null); return next;
    } catch (cause) {
      const fallback = entryFor<T>(key)?.data;
      if (fallback !== undefined) { setData(fallback); setError(null); }
      else setError(cause instanceof Error ? cause : new Error("数据暂时没有加载出来"));
      throw cause;
    } finally {
      const latest = entryFor<T>(key);
      if (latest?.promise === promise) queryCache.set(key, { data: latest.data, updatedAt: latest.updatedAt });
      setLoading(false); setRefreshing(false);
    }
  }, [fetcher, key, staleMs]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const cached = peekStaleQuery<T>(key); setData(cached); setLoading(cached === undefined); void refresh(false).catch(() => undefined);
    });
    return () => { cancelled = true; };
  }, [key, refresh]);

  useEffect(() => {
    if (!browserReady()) return;
    const handleOnline = () => { void refresh(true).catch(() => undefined); };
    window.addEventListener("online", handleOnline); return () => window.removeEventListener("online", handleOnline);
  }, [refresh]);

  const update = useCallback((next: T | ((current: T | undefined) => T)) => {
    const current = peekStaleQuery<T>(key);
    const resolved = typeof next === "function" ? (next as (current: T | undefined) => T)(current) : next;
    setStaleQueryData(key, resolved); setData(resolved);
  }, [key]);

  return { data, loading, refreshing, error, refresh, update };
}