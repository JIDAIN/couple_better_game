"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import { fetchLifeSettings } from "@/lib/life/settings-client";
import { daysTogether, type LifeSettings } from "@/lib/life/settings-service";
import type { LifeDayRecord } from "@/lib/life/life-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import { TodayActivityCard } from "./today/TodayActivityCard";
import { TodayMoodCard } from "./today/TodayMoodCard";
import { TodaySleepCard } from "./today/TodaySleepCard";
import { localIsoDate } from "./today/today-life-model";

function dayHeading(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(value);
}

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
  const settingsQuery = useStaleQuery<LifeSettings>({
    key: "life-settings",
    fetcher: fetchLifeSettings,
    staleMs: 60_000,
  });
  const togetherDay = useMemo(() => daysTogether(settingsQuery.data?.anniversaryDate ?? null, date), [date, settingsQuery.data?.anniversaryDate]);

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
    return (
      <AppPageShell title="岛屿生活" subtitle="正在前往登录…">
        <div />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      title={dayHeading(date)}
      subtitle={(
        <div className="life-today-subtitle grid gap-1">
          {togetherDay ? (
            <span className="life-together-days">
              一起度过的第 <strong>{togetherDay}</strong> 天 <span className="life-together-heart" aria-hidden>♡</span>
            </span>
          ) : null}
          <span>把普通日子里的小事，轻轻收好。</span>
        </div>
      )}
    >
      {visibleError ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_18%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{visibleError}</div> : null}
      {query.data ? (
        <div className="grid gap-3">
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