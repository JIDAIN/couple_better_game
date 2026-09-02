"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeMonth, LifeApiError } from "@/lib/life/life-client";
import type { LifeMonthMoodRecord } from "@/lib/life/calendar-service";
import type { LifePartnerKey, MoodKey } from "@/lib/life/life-service";
import { moodVisual } from "@/components/life/today/today-life-model";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const PARTNERS: Array<{ key: LifePartnerKey; label: string }> = [
  { key: "cat", label: "我" },
  { key: "fish", label: "Ta" },
];

function localMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function MoodDot({ moodKey, partner }: { moodKey?: MoodKey; partner: LifePartnerKey }) {
  const visual = moodVisual(moodKey);
  if (!visual) {
    return <span className="grid h-5 w-5 place-items-center rounded-full border border-dashed border-[var(--life-border-soft)] text-[8px] text-[var(--life-text-muted)]">{partner === "cat" ? "我" : "Ta"}</span>;
  }
  return (
    <span title={`${partner === "cat" ? "我" : "Ta"} · ${visual.label}`} className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-black text-[var(--life-text)] shadow-[var(--life-shadow-press)] ${visual.tone}`}>
      {visual.emoji}
    </span>
  );
}

export function LifeCalendarPage() {
  const [month, setMonth] = useState(() => localMonth());
  const [data, setData] = useState<LifeMonthMoodRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const today = useMemo(() => new Date().toLocaleDateString("sv-SE"), []);

  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;
    setLoading(true);
    fetchLifeMonth(month)
      .then((record) => {
        if (cancelled || requestId.current !== id) return;
        setData(record);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || requestId.current !== id) return;
        setData(null);
        setError(cause instanceof LifeApiError ? cause.message : "这个月的心情暂时没有加载出来");
      })
      .finally(() => {
        if (!cancelled && requestId.current === id) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [month]);

  const byDate = useMemo(() => new Map((data?.days ?? []).map((day) => [day.date, day.moods])), [data]);
  const cells = useMemo(() => monthCells(month), [month]);

  return (
    <AppPageShell title="日历" subtitle="把每天的心情留在月历里；点开日期再看当天发生了什么。">
      <section className="life-surface life-section-card overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <button type="button" aria-label="上个月" onClick={() => setMonth((value) => shiftMonth(value, -1))} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--life-surface-soft)] text-lg font-black text-[var(--life-text-body)]">‹</button>
          <div className="text-center">
            <p className="text-lg font-extrabold text-[var(--life-text)]">{monthTitle(month)}</p>
            <div className="mt-1 flex items-center justify-center gap-3 text-[10px] font-bold text-[var(--life-text-muted)]">
              {PARTNERS.map((person) => <span key={person.key}>{person.label}</span>)}
              {loading ? <span>加载中…</span> : null}
            </div>
          </div>
          <button type="button" aria-label="下个月" onClick={() => setMonth((value) => shiftMonth(value, 1))} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--life-surface-soft)] text-lg font-black text-[var(--life-text-body)]">›</button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-[var(--life-text-muted)]">
          {WEEKDAYS.map((day) => <div key={day} className="py-1">{day}</div>)}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="aspect-[0.78]" />;
            const moods = byDate.get(date) ?? [];
            const cat = moods.find((item) => item.partnerKey === "cat")?.moodKey;
            const fish = moods.find((item) => item.partnerKey === "fish")?.moodKey;
            const isToday = date === today;
            return (
              <Link key={date} href={`/calendar/${date}`} className={`relative flex aspect-[0.78] min-h-[4.4rem] flex-col rounded-2xl px-1.5 py-1.5 transition active:scale-[0.97] ${isToday ? "bg-[color:color-mix(in_srgb,var(--life-yellow)_32%,white)] ring-1 ring-[var(--life-yellow)]" : "bg-[var(--life-surface-soft)]"}`}>
                <span className={`text-[11px] font-extrabold ${isToday ? "text-[var(--life-text)]" : "text-[var(--life-text-body)]"}`}>{Number(date.slice(-2))}</span>
                <span className="mt-auto flex flex-wrap items-end justify-center gap-1 pb-0.5">
                  <MoodDot moodKey={cat} partner="cat" />
                  <MoodDot moodKey={fish} partner="fish" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {error ? <div className="mt-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}

      <section className="mt-3 rounded-[var(--life-radius-card)] bg-[var(--life-surface-warm)] px-4 py-3">
        <p className="text-xs font-bold text-[var(--life-text-body)]">月历只展示事实</p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--life-text-muted)]">有记录就显示当天的两个心情圆脸；没有记录就留白。不计算连续天数、完成率或谁更积极。</p>
      </section>
    </AppPageShell>
  );
}
