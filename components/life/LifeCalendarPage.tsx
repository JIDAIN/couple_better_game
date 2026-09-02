"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import { fetchLifeMonth, LifeApiError } from "@/lib/life/life-client";
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

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title="日历" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return (
    <AppPageShell title="日历" subtitle="每天最多两枚心情：第一枚是我，第二枚是 Ta。">
      <section className="life-calendar-paper">
        <div className="flex items-center justify-between gap-3 px-2">
          <button type="button" aria-label="上个月" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="life-round-button">‹</button>
          <div className="text-center">
            <p className="text-xl font-black tracking-tight text-[var(--life-text)]">{monthTitle(month)}</p>
            <p className="mt-1 text-[10px] font-bold text-[var(--life-text-muted)]">我 · Ta</p>
          </div>
          <button type="button" aria-label="下个月" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="life-round-button">›</button>
        </div>

        {query.refreshing ? <div className="life-sync-pill mx-auto mt-3 w-fit">正在同步这个月…</div> : null}
        <div className="mt-5 grid grid-cols-7 text-center text-[10px] font-extrabold text-[var(--life-text-muted)]">
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
              <Link key={date} href={`/calendar/${date}`} className="life-calendar-day" aria-label={`${date}${isToday ? "，今天" : ""}`}>
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
