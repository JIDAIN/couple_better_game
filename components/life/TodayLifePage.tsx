"use client";

import { useCallback, useEffect, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import type { LifeDayRecord } from "@/lib/life/life-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import { LifeCloudGate } from "./today/LifeCloudGate";
import { TodayActivityCard } from "./today/TodayActivityCard";
import { TodayMoodCard } from "./today/TodayMoodCard";
import { TodaySleepCard } from "./today/TodaySleepCard";
import { displayDate, localIsoDate } from "./today/today-life-model";

export function TodayLifePage() {
  const [date] = useState(() => localIsoDate());
  const [needsLogin, setNeedsLogin] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useCallback(() => fetchLifeDay(date), [date]);
  const query = useStaleQuery<LifeDayRecord>({
    key: `life-day:${date}`,
    fetcher,
    staleMs: 20_000,
  });

  useEffect(() => {
    if (!query.error) return;
    if (query.error instanceof LifeApiError && query.error.status === 401) {
      setNeedsLogin(true);
      return;
    }
    setActionError(query.error.message || "读取今天的生活记录失败");
  }, [query.error]);

  const reload = useCallback(async () => {
    setActionError(null);
    try {
      await query.refresh(true);
      setNeedsLogin(false);
    } catch (cause) {
      if (cause instanceof LifeApiError && cause.status === 401) {
        setNeedsLogin(true);
        return;
      }
      setActionError(cause instanceof Error ? cause.message : "读取今天的生活记录失败");
    }
  }, [query]);

  if (needsLogin) return <LifeCloudGate onConnected={reload} />;

  return (
    <AppPageShell title={displayDate(date)} subtitle="只记重要的小日常，照顾好彼此。">
      {actionError ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_18%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{actionError}</div> : null}
      {query.data ? (
        <div className="grid gap-3">
          {query.refreshing ? <div className="life-sync-pill" aria-live="polite">正在同步最新记录…</div> : null}
          <TodayMoodCard date={date} day={query.data} onChanged={reload} onError={setActionError} />
          <TodaySleepCard date={date} day={query.data} onChanged={reload} onError={setActionError} />
          <TodayActivityCard date={date} day={query.data} onChanged={reload} onError={setActionError} />
        </div>
      ) : query.loading ? (
        <div className="life-surface life-section-card text-center text-sm text-[var(--life-text-muted)]">第一次读取今天的记录…</div>
      ) : (
        <div className="life-surface life-section-card text-center text-sm text-[var(--life-text-muted)]">今天的记录暂时没有加载出来。</div>
      )}
    </AppPageShell>
  );
}
