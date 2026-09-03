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

function TogetherHearts() {
  return (
    <span className="life-together-heart" aria-hidden>
      <svg viewBox="0 0 28 22" fill="none">
        <path d="M9.1 18.6C4.8 15.5 2.2 12.8 2.2 9.1c0-2.6 2-4.6 4.6-4.6 1.5 0 2.9.7 3.8 1.8.9-1.1 2.3-1.8 3.8-1.8 2.6 0 4.6 2 4.6 4.6 0 3.7-2.6 6.4-6.9 9.5l-1.5 1.1-1.5-1.1Z" />
        <path d="M18.6 15.5c-2.5-1.8-4-3.4-4-5.5 0-1.7 1.3-3 3-3 1 0 1.9.4 2.5 1.2.6-.8 1.5-1.2 2.5-1.2 1.7 0 3 1.3 3 3 0 2.1-1.5 3.7-4 5.5l-1 .7-1-.7Z" />
      </svg>
    </span>
  );
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
              一起度过的第 <strong>{togetherDay}</strong> 天 <TogetherHearts />
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