"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CacheEntry<T> = {
  data?: T;
  updatedAt: number;
  promise?: Promise<T>;
};

const queryCache = new Map<string, CacheEntry<unknown>>();

function entryFor<T>(key: string) {
  return queryCache.get(key) as CacheEntry<T> | undefined;
}

export function peekStaleQuery<T>(key: string) {
  return entryFor<T>(key)?.data;
}

export function setStaleQueryData<T>(key: string, data: T) {
  queryCache.set(key, { data, updatedAt: Date.now() });
}

export function invalidateStaleQuery(prefix: string) {
  for (const [key, entry] of queryCache.entries()) {
    if (!key.startsWith(prefix)) continue;
    queryCache.set(key, { ...entry, updatedAt: 0 });
  }
}

export function clearStaleQueries() {
  queryCache.clear();
}

export async function prefetchStaleQuery<T>({
  key,
  fetcher,
  staleMs = 30_000,
}: {
  key: string;
  fetcher: () => Promise<T>;
  staleMs?: number;
}) {
  const cached = entryFor<T>(key);
  const fresh = cached?.data !== undefined && Date.now() - cached.updatedAt < staleMs;
  if (fresh) return cached.data;
  if (cached?.promise) return cached.promise;

  const promise = fetcher();
  queryCache.set(key, { data: cached?.data, updatedAt: cached?.updatedAt ?? 0, promise });
  try {
    const data = await promise;
    queryCache.set(key, { data, updatedAt: Date.now() });
    return data;
  } catch (cause) {
    queryCache.set(key, { data: cached?.data, updatedAt: cached?.updatedAt ?? 0 });
    throw cause;
  }
}

export function useStaleQuery<T>({
  key,
  fetcher,
  staleMs = 30_000,
}: {
  key: string;
  fetcher: () => Promise<T>;
  staleMs?: number;
}) {
  const initial = useMemo(() => peekStaleQuery<T>(key), [key]);
  const [data, setData] = useState<T | undefined>(initial);
  const [loading, setLoading] = useState(initial === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (force = false) => {
    const cached = entryFor<T>(key);
    const fresh = cached?.data !== undefined && Date.now() - cached.updatedAt < staleMs;
    if (!force && fresh) {
      setData(cached.data);
      setLoading(false);
      return cached.data;
    }

    setRefreshing(cached?.data !== undefined);
    if (cached?.data === undefined) setLoading(true);

    let promise = cached?.promise;
    if (!promise) {
      promise = fetcher();
      queryCache.set(key, {
        data: cached?.data,
        updatedAt: cached?.updatedAt ?? 0,
        promise,
      });
    }

    try {
      const next = await promise;
      queryCache.set(key, { data: next, updatedAt: Date.now() });
      setData(next);
      setError(null);
      return next;
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("数据暂时没有加载出来"));
      throw cause;
    } finally {
      const latest = entryFor<T>(key);
      if (latest?.promise === promise) {
        queryCache.set(key, {
          data: latest.data,
          updatedAt: latest.updatedAt,
        });
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetcher, key, staleMs]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const cached = peekStaleQuery<T>(key);
      setData(cached);
      setLoading(cached === undefined);
      void refresh(false).catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [key, refresh]);

  const update = useCallback((next: T | ((current: T | undefined) => T)) => {
    const current = peekStaleQuery<T>(key);
    const resolved = typeof next === "function"
      ? (next as (current: T | undefined) => T)(current)
      : next;
    setStaleQueryData(key, resolved);
    setData(resolved);
  }, [key]);

  return { data, loading, refreshing, error, refresh, update };
}
