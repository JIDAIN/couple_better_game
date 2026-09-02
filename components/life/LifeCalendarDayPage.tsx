"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { fetchLifeDay, LifeApiError } from "@/lib/life/life-client";
import { fetchMeals, MealApiError } from "@/lib/nutrition/meal-client";
import type { LifeDayRecord, LifePartnerKey, MoodRecord, SleepRecord } from "@/lib/life/life-service";
import type { MealRecord, NutritionPartnerKey } from "@/lib/nutrition/meal-service";
import { displayDate, durationText, formatTime, moodVisual } from "@/components/life/today/today-life-model";

const PEOPLE: Array<{ key: LifePartnerKey; mealKey: NutritionPartnerKey; label: string }> = [
  { key: "cat", mealKey: "cat", label: "我" },
  { key: "fish", mealKey: "fish", label: "Ta" },
];

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
      {visual ? (
        <>
          <span className={`mx-auto mt-2 grid h-12 w-12 place-items-center rounded-full text-sm font-black text-[var(--life-text)] shadow-[var(--life-shadow-press)] ${visual.tone}`}>{visual.emoji}</span>
          <p className="mt-1.5 text-xs font-extrabold text-[var(--life-text)]">{visual.label}</p>
        </>
      ) : <p className="mt-5 text-xs font-bold text-[var(--life-text-muted)]">未记录</p>}
    </div>
  );
}

export function LifeCalendarDayPage({ date }: { date: string }) {
  const [day, setDay] = useState<LifeDayRecord | null>(null);
  const [meMeals, setMeMeals] = useState<MealRecord[]>([]);
  const [taMeals, setTaMeals] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLifeDay(date),
      fetchMeals({ mealDate: date, partnerKey: "cat" }),
      fetchMeals({ mealDate: date, partnerKey: "fish" }),
    ])
      .then(([lifeDay, catMeals, fishMeals]) => {
        if (cancelled) return;
        setDay(lifeDay);
        setMeMeals(catMeals.filter((meal) => meal.deletedAt == null));
        setTaMeals(fishMeals.filter((meal) => meal.deletedAt == null));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof LifeApiError || cause instanceof MealApiError) setError(cause.message);
        else setError("这一天的生活记录暂时没有加载出来");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date]);

  const mealsByPerson = useMemo(() => new Map<LifePartnerKey, MealRecord[]>([["cat", meMeals], ["fish", taMeals]]), [meMeals, taMeals]);

  return (
    <AppPageShell title={displayDate(date)} subtitle="当天记录的事实汇总，不做评分。" actions={<Link href="/calendar" className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-extrabold text-[var(--life-teal-strong)]">返回月历</Link>}>
      {loading ? <div className="life-surface life-section-card text-sm font-bold text-[var(--life-text-muted)]">正在翻这一天的记录…</div> : null}
      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}

      {day ? (
        <div className="grid gap-3">
          <section className="life-surface life-section-card">
            <p className="text-sm font-extrabold text-[var(--life-text)]">今天的心情</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {PEOPLE.map((person) => <PersonMood key={person.key} label={person.label} mood={personMood(day.moods, person.key)} />)}
            </div>
          </section>

          <section className="life-surface life-section-card">
            <p className="text-sm font-extrabold text-[var(--life-text)]">睡眠</p>
            <div className="mt-3 grid gap-2">
              {PEOPLE.map((person) => {
                const sleep = personSleep(day.sleeps, person.key);
                return (
                  <div key={person.key} className="flex items-center justify-between gap-3 rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-2.5">
                    <div><p className="text-xs font-extrabold text-[var(--life-text)]">{person.label}</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">{sleep ? `${formatTime(sleep.fellAsleepAt)} 入睡 · ${formatTime(sleep.wokeAt)} 起床` : "未记录入睡和起床时间"}</p></div>
                    <strong className="shrink-0 text-sm tabular-nums text-[var(--life-text-body)]">{durationText(sleep)}</strong>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="life-surface life-section-card">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">活动</p><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{day.activities.length} 条</span></div>
            <div className="mt-3 grid gap-2">
              {day.activities.length ? day.activities.map((activity) => (
                <div key={activity.id} className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-2.5">
                  <p className="text-sm font-bold leading-5 text-[var(--life-text-body)]">{activity.text}</p>
                  <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">{activity.participantScope === "both" ? "一起" : activity.participantScope === "cat" ? "我" : "Ta"}{activity.durationMinutes != null ? ` · ${activity.durationMinutes} 分钟` : ""}</p>
                </div>
              )) : <p className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--life-text-muted)]">这一天没有活动记录</p>}
            </div>
          </section>

          <section className="life-surface life-section-card">
            <div className="flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">饮食</p><Link href="/food" className="text-xs font-extrabold text-[var(--life-teal-strong)]">打开饮食页</Link></div>
            <div className="mt-3 grid gap-2.5">
              {PEOPLE.map((person) => {
                const meals = mealsByPerson.get(person.key) ?? [];
                return (
                  <div key={person.key} className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3">
                    <div className="flex items-center justify-between gap-3"><p className="text-xs font-extrabold text-[var(--life-text)]">{person.label}</p><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{calorieSummary(meals)}</span></div>
                    {meals.length ? <p className="mt-1.5 line-clamp-3 text-xs leading-5 text-[var(--life-text-body)]">{meals.map((meal) => mealNames(meal)).join("；")}</p> : <p className="mt-1.5 text-xs text-[var(--life-text-muted)]">没有饮食记录</p>}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </AppPageShell>
  );
}
