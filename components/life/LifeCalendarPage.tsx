"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { prefetchStaleQuery, useStaleQuery } from "@/lib/client/use-stale-query";
import { fetchLifeDay, fetchLifeMonth, LifeApiError } from "@/lib/life/life-client";
import { fetchMeals } from "@/lib/nutrition/meal-client";
import type { NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import type { LifeMonthMoodRecord } from "@/lib/life/calendar-service";
import type { MoodKey } from "@/lib/life/life-service";
import { moodVisual } from "@/components/life/today/today-life-model";
import { MoodIcon } from "@/components/ui/MoodIcon";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function localMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function monthTitle(month: string) {
  const [year, value] = month.split("-").map(Number);
  return `${year}年 ${value}月`;
}
function shiftMonth(month: string, amount: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function monthCells(month: string) {
  const [year, value] = month.split("-").map(Number);
  const days = new Date(year, value, 0).getDate();
  const firstJsDay = new Date(year, value - 1, 1).getDay();
  const firstMondayIndex = (firstJsDay + 6) % 7;
  const cells: Array<string | null> = Array(firstMondayIndex).fill(null);
  for (let day = 1; day <= days; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MoodStamp({ moodKey, label, offset = false }: { moodKey?: MoodKey; label: "我" | "Ta"; offset?: boolean }) {
  const visual = moodVisual(moodKey);
  if (!visual) return null;
  return (
    <span
      title={`${label} · ${visual.label}`}
      className={`life-calendar-mood ${offset ? "is-offset" : ""}`}
      aria-label={`${label}：${visual.label}`}
    >
      <MoodIcon moodKey={visual.key} label="" />
    </span>
  );
}

export function LifeCalendarPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [month, setMonth] = useState(() => localMonth());
  const today = useMemo(() => localDate(), []);
  const fetcher = useCallback(() => fetchLifeMonth(month), [month]);
  const query = useStaleQuery<LifeMonthMoodRecord>({ key: `life-month:${month}`, fetcher, staleMs: 60_000 });
  const byDate = useMemo(() => new Map((query.data?.days ?? []).map((day) => [day.date, day.moods])), [query.data]);
  const cells = useMemo(() => monthCells(month), [month]);
  const error = query.error instanceof LifeApiError ? query.error.message : query.error?.message ?? null;

  const warmDay = useCallback((date: string) => {
    if (!mePartnerKey || !taPartnerKey) return;
    const me = mePartnerKey as NutritionPartnerKey;
    const ta = taPartnerKey as NutritionPartnerKey;
    void Promise.allSettled([
      prefetchStaleQuery({ key: `life-day:${date}`, fetcher: () => fetchLifeDay(date), staleMs: 20_000 }),
      prefetchStaleQuery({ key: `meals:${me}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: me })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
      prefetchStaleQuery({ key: `meals:${ta}:${date}`, fetcher: async () => (await fetchMeals({ mealDate: date, partnerKey: ta })).filter((meal) => !meal.deletedAt), staleMs: 20_000 }),
    ]);
  }, [mePartnerKey, taPartnerKey]);

  useEffect(() => {
    if (!query.data) return;
    // Prewarm the most recent recorded dates. This covers the dates users are most likely to open
    // without turning a month view into 90 eager API calls.
    const recent = query.data.days
      .filter((day) => day.moods.length > 0)
      .map((day) => day.date)
      .sort()
      .slice(-8);
    for (const date of recent) warmDay(date);
  }, [query.data, warmDay]);

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title="日历" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return (
    <AppPageShell>
      <section className="life-calendar-paper life-calendar-page">
        <div className="flex items-center justify-between gap-3 px-2">
          <button type="button" aria-label="上个月" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="life-round-button">‹</button>
          <div className="text-center">
            <p className="text-lg font-black tracking-tight text-[var(--life-text)]">{monthTitle(month)}</p>
            <p className="mt-1 text-[10px] font-bold text-[var(--life-text-muted)]">我 · Ta</p>
          </div>
          <button type="button" aria-label="下个月" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="life-round-button">›</button>
        </div>

        <div className="mt-4 grid grid-cols-7 text-center text-[10px] font-extrabold text-[var(--life-text-muted)]">
          {WEEKDAYS.map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-y-1">
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="h-[5.2rem]" />;
            const moods = byDate.get(date) ?? [];
            const meMood = moods.find((item) => item.partnerKey === mePartnerKey)?.moodKey;
            const taMood = moods.find((item) => item.partnerKey === taPartnerKey)?.moodKey;
            const isToday = date === today;
            return (
              <Link
                key={date}
                href={`/calendar/${date}`}
                className="life-calendar-day"
                aria-label={`${date}${isToday ? "，今天" : ""}`}
                onPointerEnter={() => warmDay(date)}
                onPointerDown={() => warmDay(date)}
                onFocus={() => warmDay(date)}
              >
                <span className={`life-calendar-date ${isToday ? "is-today" : ""}`}>
                  {isToday ? <span className="life-today-sun" aria-hidden>☀️</span> : null}
                  <span>{Number(date.slice(-2))}</span>
                </span>
                <span className="life-calendar-moods">
                  <MoodStamp moodKey={meMood} label="我" />
                  <MoodStamp moodKey={taMood} label="Ta" offset={Boolean(meMood && taMood)} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {error ? <div className="mt-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
      <p className="mt-3 px-2 text-center text-[10px] leading-5 text-[var(--life-text-muted)]">没有记录就留白；今天用小太阳标记。</p>
    </AppPageShell>
  );
}
