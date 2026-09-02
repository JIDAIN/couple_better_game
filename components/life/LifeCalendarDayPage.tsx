"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import { fetchMeals, MealApiError } from "@/lib/nutrition/meal-client";
import type { LifeDayRecord, LifePartnerKey, MoodRecord, SleepRecord } from "@/lib/life/life-service";
import type { MealRecord, NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import { displayDate, durationText, formatTime, moodVisual } from "@/components/life/today/today-life-model";
import { MoodIcon } from "@/components/ui/MoodIcon";

function personMood(moods: MoodRecord[], key: LifePartnerKey) {
  return moods.find((item) => item.partnerKey === key);
}

function personSleep(sleeps: SleepRecord[], key: LifePartnerKey) {
  return sleeps.find((item) => item.partnerKey === key);
}

function mealNames(meal: MealRecord) {
  return meal.items.map((item) => item.displayName || item.rawName).filter(Boolean).join("、") || "已记录一餐";
}

function calorieSummary(meals: MealRecord[]) {
  if (!meals.length) return "未记录";
  if (meals.some((meal) => meal.totalCaloriesKcal == null)) return `${meals.length} 餐 · 热量未完整估算`;
  return `${meals.length} 餐 · ${meals.reduce((sum, meal) => sum + (meal.totalCaloriesKcal ?? 0), 0)} kcal`;
}

function PersonMood({ label, mood }: { label: string; mood?: MoodRecord }) {
  const visual = moodVisual(mood?.moodKey);
  return (
    <div className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-center">
      <p className="text-[10px] font-bold text-[var(--life-text-muted)]">{label}</p>
      {visual ? <><MoodIcon moodKey={visual.key} label={visual.label} className="mx-auto mt-2 h-14 w-14" /><p className="mt-1.5 text-xs font-extrabold text-[var(--life-text)]">{visual.label}</p></> : <p className="mt-5 text-xs font-bold text-[var(--life-text-muted)]">未记录</p>}
    </div>
  );
}

export function LifeCalendarDayPage({ date }: { date: string }) {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [day, setDay] = useState<LifeDayRecord | null>(null);
  const [meMeals, setMeMeals] = useState<MealRecord[]>([]);
  const [taMeals, setTaMeals] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mePartnerKey || !taPartnerKey) return;
    let cancelled = false;
    Promise.all([
      fetchLifeDay(date),
      fetchMeals({ mealDate: date, partnerKey: mePartnerKey as NutritionPartnerKey }),
      fetchMeals({ mealDate: date, partnerKey: taPartnerKey as NutritionPartnerKey }),
    ])
      .then(([lifeDay, currentMeals, partnerMeals]) => {
        if (cancelled) return;
        setDay(lifeDay);
        setMeMeals(currentMeals.filter((meal) => meal.deletedAt == null));
        setTaMeals(partnerMeals.filter((meal) => meal.deletedAt == null));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof LifeApiError || cause instanceof MealApiError) setError(cause.message);
        else setError("这一天的生活记录暂时没有加载出来");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, mePartnerKey, taPartnerKey]);

  const people = useMemo(() => {
    if (!mePartnerKey || !taPartnerKey) return [] as Array<{ key: LifePartnerKey; label: "我" | "Ta" }>;
    return [{ key: mePartnerKey, label: "我" as const }, { key: taPartnerKey, label: "Ta" as const }];
  }, [mePartnerKey, taPartnerKey]);
  const mealsByPerson = useMemo(() => {
    if (!mePartnerKey || !taPartnerKey) return new Map<LifePartnerKey, MealRecord[]>();
    return new Map<LifePartnerKey, MealRecord[]>([[mePartnerKey, meMeals], [taPartnerKey, taMeals]]);
  }, [meMeals, mePartnerKey, taMeals, taPartnerKey]);

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title={displayDate(date)} subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return (
    <AppPageShell title={displayDate(date)} subtitle="回看这一天的小日常。" actions={<Link href="/calendar" className="life-back-link">返回月历</Link>}>
      {loading ? <div className="life-surface life-section-card text-sm font-bold text-[var(--life-text-muted)]">正在翻这一天的记录…</div> : null}
      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}

      {day ? <div className="grid gap-3">
        <section className="life-surface life-section-card"><p className="text-sm font-extrabold text-[var(--life-text)]">今天的心情</p><div className="mt-3 grid grid-cols-2 gap-2.5">{people.map((person) => <PersonMood key={person.key} label={person.label} mood={personMood(day.moods, person.key)} />)}</div></section>

        <section className="life-surface life-section-card"><p className="text-sm font-extrabold text-[var(--life-text)]">睡眠</p><div className="mt-3 grid gap-2">{people.map((person) => { const sleep = personSleep(day.sleeps, person.key); return <div key={person.key} className="flex items-center justify-between gap-3 rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-2.5"><div><p className="text-xs font-extrabold text-[var(--life-text)]">{person.label}</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">{sleep ? `${formatTime(sleep.fellAsleepAt)} 入睡 · ${formatTime(sleep.wokeAt)} 起床` : "未记录入睡和起床时间"}</p></div><strong className="shrink-0 text-sm tabular-nums text-[var(--life-text-body)]">{durationText(sleep)}</strong></div>; })}</div></section>

        <section className="life-surface life-section-card"><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">活动</p><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{day.activities.length} 条</span></div><div className="mt-3 grid gap-2">{day.activities.length ? day.activities.map((activity) => <div key={activity.id} className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-2.5"><p className="text-sm font-bold leading-5 text-[var(--life-text-body)]">{activity.text}</p><p className="mt-1 text-[10px] text-[var(--life-text-muted)]">{activity.participantScope === "both" ? "一起" : activity.participantScope === mePartnerKey ? "我" : "Ta"}{activity.durationMinutes != null ? ` · ${activity.durationMinutes} 分钟` : ""}</p></div>) : <p className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--life-text-muted)]">这一天没有活动记录</p>}</div></section>

        <section className="life-surface life-section-card"><div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">饮食</p><Link href="/food" className="text-xs font-extrabold text-[var(--life-teal-strong)]">打开饮食页</Link></div><div className="mt-3 grid gap-2.5">{people.map((person) => { const meals = mealsByPerson.get(person.key) ?? []; return <div key={person.key} className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3"><div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold text-[var(--life-text)]">{person.label}</p><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{calorieSummary(meals)}</span></div>{meals.length ? <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-[var(--life-text-body)]">{meals.map((meal) => mealNames(meal)).join("；")}</p> : <p className="mt-1.5 text-xs text-[var(--life-text-muted)]">没有饮食记录</p>}</div>; })}</div></section>
      </div> : null}
    </AppPageShell>
  );
}
