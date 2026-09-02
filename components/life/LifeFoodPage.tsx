"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppRoleSwitch, type AppRoleSwitchValue } from "@/components/ui/AppRoleSwitch";
import { AppNutritionBar } from "@/components/ui/AppNutritionBar";
import { fetchMeals, MealApiError } from "@/lib/nutrition/meal-client";
import type { MealRecord, MealType, NutritionPartnerKey } from "@/lib/nutrition/meal-service";

const SELF_KEY: NutritionPartnerKey = "cat";
const TA_KEY: NutritionPartnerKey = "fish";
const MEAL_TYPES: Array<{ type: MealType; label: string; icon: string }> = [
  { type: "breakfast", label: "早餐", icon: "☀️" },
  { type: "lunch", label: "午餐", icon: "🍚" },
  { type: "dinner", label: "晚餐", icon: "🌙" },
  { type: "snack", label: "加餐", icon: "🍓" },
];

function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mealNames(meal: MealRecord) {
  return meal.items.map((item) => item.displayName || item.rawName).filter(Boolean).join("、") || "已记录一餐";
}

function macroTotals(meals: MealRecord[]) {
  return meals.reduce(
    (acc, meal) => {
      meal.items.forEach((item) => {
        if (item.carbsG != null) {
          acc.carbs += item.carbsG;
          acc.hasCarbs = true;
        }
        if (item.proteinG != null) {
          acc.protein += item.proteinG;
          acc.hasProtein = true;
        }
        if (item.fatG != null) {
          acc.fat += item.fatG;
          acc.hasFat = true;
        }
      });
      acc.calories += meal.totalCaloriesKcal;
      return acc;
    },
    { carbs: 0, protein: 0, fat: 0, calories: 0, hasCarbs: false, hasProtein: false, hasFat: false },
  );
}

function mealHref(date: string, partnerKey: NutritionPartnerKey, mealType: MealType, mealId?: string) {
  const params = new URLSearchParams({ date, person: partnerKey, type: mealType });
  if (mealId) params.set("mealId", mealId);
  return `/food/edit?${params.toString()}`;
}

function MealPhotoSlot({ meal, label }: { meal?: MealRecord; label: string }) {
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--life-radius-control)] bg-[linear-gradient(145deg,var(--life-surface-warm),color-mix(in_srgb,var(--life-yellow)_30%,white))]">
      <div className="absolute inset-0 grid place-items-center px-3 text-center">
        <div>
          <div className="text-3xl" aria-hidden>🍽️</div>
          <p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--life-text-body)]">
            {meal ? mealNames(meal) : `${label}还没有记录`}
          </p>
          <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">实物照片位已预留</p>
        </div>
      </div>
    </div>
  );
}

function MealNutrition({ meal }: { meal?: MealRecord }) {
  const totals = macroTotals(meal ? [meal] : []);
  const empty = !meal;
  return (
    <div className="grid gap-2">
      <AppNutritionBar label="碳水" value={empty || !totals.hasCarbs ? null : Number(totals.carbs.toFixed(1))} unit="g" max={100} />
      <AppNutritionBar label="蛋白质" value={empty || !totals.hasProtein ? null : Number(totals.protein.toFixed(1))} unit="g" max={60} />
      <AppNutritionBar label="脂肪" value={empty || !totals.hasFat ? null : Number(totals.fat.toFixed(1))} unit="g" max={50} />
      <div className="flex items-baseline justify-between border-t border-[var(--life-border-soft)] pt-2">
        <span className="text-xs font-bold text-[var(--life-text-body)]">总热量</span>
        <span className="text-base font-extrabold tabular-nums text-[var(--life-text)]">
          {meal ? `${meal.totalCaloriesKcal} kcal` : "—"}
        </span>
      </div>
    </div>
  );
}

export function LifeFoodPage() {
  const [role, setRole] = useState<AppRoleSwitchValue>("me");
  const [date, setDate] = useState(() => localIsoDate());
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const partnerKey = role === "me" ? SELF_KEY : TA_KEY;

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    let cancelled = false;
    fetchMeals({ mealDate: date, partnerKey })
      .then((records) => {
        if (cancelled || requestId.current !== id) return;
        setMeals(records.filter((meal) => meal.deletedAt == null));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || requestId.current !== id) return;
        setMeals([]);
        setError(cause instanceof MealApiError ? cause.message : "饮食记录暂时没有加载出来");
      })
      .finally(() => {
        if (!cancelled && requestId.current === id) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, partnerKey]);

  const grouped = useMemo(() => {
    const map = new Map<MealType, MealRecord[]>();
    MEAL_TYPES.forEach(({ type }) => map.set(type, []));
    meals.forEach((meal) => {
      if (map.has(meal.mealType)) map.get(meal.mealType)?.push(meal);
    });
    return map;
  }, [meals]);
  const daily = useMemo(() => macroTotals(meals), [meals]);

  function changeRole(next: AppRoleSwitchValue) {
    if (next === role) return;
    setLoading(true);
    setRole(next);
  }

  function changeDate(next: string) {
    if (!next || next === date) return;
    setLoading(true);
    setDate(next);
  }

  return (
    <AppPageShell title="饮食" subtitle="一天吃了什么，单独查看我或 Ta。">
      <div className="mb-4 grid gap-3">
        <AppRoleSwitch value={role} onChange={changeRole} />
        <label className="life-surface flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-xs font-bold text-[var(--life-text-body)]">查看日期</span>
          <input
            type="date"
            value={date}
            onChange={(event) => changeDate(event.target.value)}
            className="rounded-xl border border-[var(--life-border-soft)] bg-[var(--life-surface)] px-2.5 py-1.5 text-sm font-bold text-[var(--life-text)]"
          />
        </label>
      </div>

      {error ? <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_16%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{error}</div> : null}

      <div className="grid gap-3">
        {MEAL_TYPES.map(({ type, label, icon }) => {
          const records = grouped.get(type) ?? [];
          const primary = records[0];
          return (
            <section key={type} className="life-surface life-section-card">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-[var(--life-text)]">{icon} {label}</p>
                  {records.length > 1 ? <p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">当天共记录 {records.length} 餐</p> : null}
                </div>
                <Link
                  href={mealHref(date, partnerKey, type, primary?.id)}
                  className="rounded-full bg-[var(--life-mint)] px-3 py-1.5 text-xs font-extrabold text-[#255f4d] shadow-[var(--life-shadow-press)]"
                >
                  {primary ? "编辑" : "+ 添加"}
                </Link>
              </div>
              <div className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] gap-3">
                <MealPhotoSlot meal={primary} label={label} />
                <MealNutrition meal={primary} />
              </div>
              {records.length > 1 ? (
                <div className="mt-3 border-t border-[var(--life-border-soft)] pt-2 text-xs text-[var(--life-text-body)]">
                  其他记录：{records.slice(1).map(mealNames).join("；")}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section className="life-surface life-section-card mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold text-[var(--life-text)]">今日摄入统计</p>
            <p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">只反映当天实际记录，不用于排名。</p>
          </div>
          {loading ? <span className="text-xs text-[var(--life-text-muted)]">加载中…</span> : null}
        </div>
        <div className="grid gap-2.5">
          <AppNutritionBar label="碳水" value={daily.hasCarbs ? Number(daily.carbs.toFixed(1)) : null} unit="g" max={300} />
          <AppNutritionBar label="蛋白质" value={daily.hasProtein ? Number(daily.protein.toFixed(1)) : null} unit="g" max={120} />
          <AppNutritionBar label="脂肪" value={daily.hasFat ? Number(daily.fat.toFixed(1)) : null} unit="g" max={100} />
          <div className="mt-1 flex items-center justify-between rounded-[var(--life-radius-control)] bg-[var(--life-surface-warm)] px-3 py-2.5">
            <span className="text-sm font-bold text-[var(--life-text-body)]">总热量</span>
            <span className="text-lg font-extrabold tabular-nums text-[var(--life-text)]">{meals.length ? `${daily.calories} kcal` : "未记录"}</span>
          </div>
        </div>
      </section>
    </AppPageShell>
  );
}
