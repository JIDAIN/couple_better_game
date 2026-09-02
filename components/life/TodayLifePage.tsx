"use client";

import { useCallback, useEffect, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import type { LifeDayRecord } from "@/lib/life/life-service";
import { LifeCloudGate } from "./today/LifeCloudGate";
import { TodayActivityCard } from "./today/TodayActivityCard";
import { TodayMoodCard } from "./today/TodayMoodCard";
import { TodaySleepCard } from "./today/TodaySleepCard";
import { displayDate, localIsoDate } from "./today/today-life-model";

export function TodayLifePage() {
  const [date] = useState(() => localIsoDate());
  const [day, setDay] = useState<LifeDayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchLifeDay(date);
      setDay(next);
      setNeedsLogin(false);
    } catch (cause) {
      if (cause instanceof LifeApiError && cause.status === 401) {
        setNeedsLogin(true);
        setDay(null);
      } else {
        setError(cause instanceof Error ? cause.message : "读取今天的生活记录失败");
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    let active = true;
    fetchLifeDay(date)
      .then((next) => {
        if (!active) return;
        setDay(next);
        setNeedsLogin(false);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof LifeApiError && cause.status === 401) {
          setNeedsLogin(true);
          setDay(null);
          return;
        }
        setError(cause instanceof Error ? cause.message : "读取今天的生活记录失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date]);

  if (needsLogin) return <LifeCloudGate onConnected={reload} />;

  return (
    <AppPageShell title={displayDate(date)} subtitle="只记重要的小日常，照顾好彼此。">
      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_18%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{error}</div> : null}
      {loading && !day ? (
        <div className="life-surface life-section-card text-center text-sm text-[var(--life-text-muted)]">正在看看今天留下了什么…</div>
      ) : day ? (
        <div className="grid gap-3">
          <TodayMoodCard date={date} day={day} onChanged={reload} onError={setError} />
          <TodaySleepCard date={date} day={day} onChanged={reload} onError={setError} />
          <TodayActivityCard date={date} day={day} onChanged={reload} onError={setError} />
        </div>
      ) : (
        <div className="life-surface life-section-card text-center text-sm text-[var(--life-text-muted)]">今天的记录暂时没有加载出来。</div>
      )}
    </AppPageShell>
  );
}
