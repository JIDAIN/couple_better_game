"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import type { LifeDayRecord } from "@/lib/life/life-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import { TodayActivityCard } from "./today/TodayActivityCard";
import { TodayMoodCard } from "./today/TodayMoodCard";
import { TodaySleepCard } from "./today/TodaySleepCard";
import { displayDate, localIsoDate } from "./today/today-life-model";

export function TodayLifePage() {
  const router = useRouter();
  const [date] = useState(() => localIsoDate());
  const [actionError, setActionError] = useState<string | null>(null);
  const fetcher = useCallback(() => fetchLifeDay(date), [date]);
  const query = useStaleQuery<LifeDayRecord>({
    key: `life-day:${date}`,
    fetcher,
    staleMs: 20_000,
  });

  const queryNeedsLogin = query.error instanceof LifeApiError && query.error.status === 401;
  const queryError = query.error && !queryNeedsLogin
    ? query.error.message || "读取今天的生活记录失败"
    : null;
  const visibleError = actionError ?? queryError;

  useEffect(() => {
    if (queryNeedsLogin) router.replace("/login");
  }, [queryNeedsLogin, router]);

  const reload = useCallback(async () => {
    setActionError(null);
    try {
      await query.refresh(true);
    } catch (cause) {
      if (cause instanceof LifeApiError && cause.status === 401) {
        router.replace("/login");
        return;
      }
      setActionError(cause instanceof Error ? cause.message : "读取今天的生活记录失败");
    }
  }, [query, router]);

  if (queryNeedsLogin) {
    return <AppPageShell title="岛屿生活" subtitle="正在前往登录…" />;
  }

  return (
    <AppPageShell title={displayDate(date)} subtitle="只记重要的小日常，照顾好彼此。">
      {visibleError ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_18%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{visibleError}</div> : null}
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
