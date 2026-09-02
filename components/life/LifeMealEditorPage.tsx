"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppRoleSwitch, type AppRoleSwitchValue } from "@/components/ui/AppRoleSwitch";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { createMealRecord, fetchMeals, MealApiError, updateMealRecord } from "@/lib/nutrition/meal-client";
import type { MealItemRecord, MealRecord, MealType, MealWritePayload, NutritionPartnerKey } from "@/lib/nutrition/meal-service";

const MEAL_OPTIONS: Array<{ value: MealType; label: string }> = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
];

type ItemDraft = {
  key: string;
  rawName: string;
  portionDescription: string;
  caloriesKcal: string;
  carbsG: string;
  proteinG: string;
  fatG: string;
};

function key() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function emptyItem(): ItemDraft {
  return { key: key(), rawName: "", portionDescription: "", caloriesKcal: "", carbsG: "", proteinG: "", fatG: "" };
}

function fromItem(item: MealItemRecord): ItemDraft {
  return {
    key: item.id,
    rawName: item.rawName,
    portionDescription: item.portionDescription ?? "",
    caloriesKcal: item.caloriesKcal == null ? "" : String(item.caloriesKcal),
    carbsG: item.carbsG == null ? "" : String(item.carbsG),
    proteinG: item.proteinG == null ? "" : String(item.proteinG),
    fatG: item.fatG == null ? "" : String(item.fatG),
  };
}

function numberOrNull(value: string) {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : NaN;
}

function dateTimeWithLocalOffset(mealDate: string, time: string) {
  if (!time) return null;
  const local = new Date(`${mealDate}T${time}:00`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export function LifeMealEditorPage() {
  const router = useRouter();
  const params = useSearchParams();
  const mealId = params.get("mealId");
  const initialDate = params.get("date") || new Date().toISOString().slice(0, 10);
  const initialPartner: NutritionPartnerKey = params.get("person") === "fish" ? "fish" : "cat";
  const requestedType = params.get("type") as MealType | null;
  const initialType = MEAL_OPTIONS.some((item) => item.value === requestedType) ? (requestedType as MealType) : "lunch";

  const [meal, setMeal] = useState<MealRecord | null>(null);
  const [role, setRole] = useState<AppRoleSwitchValue>(initialPartner === "cat" ? "me" : "partner");
  const [date, setDate] = useState(initialDate);
  const [mealType, setMealType] = useState<MealType>(initialType);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [loading, setLoading] = useState(Boolean(mealId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const partnerKey: NutritionPartnerKey = role === "me" ? "cat" : "fish";

  useEffect(() => {
    if (!mealId) return;
    let cancelled = false;
    fetchMeals({ mealDate: initialDate, partnerKey: initialPartner })
      .then((records) => {
        if (cancelled) return;
        const found = records.find((record) => record.id === mealId) ?? null;
        if (!found) throw new Error("没有找到这餐记录");
        setMeal(found);
        setRole(found.partnerKey === "cat" ? "me" : "partner");
        setDate(found.mealDate);
        setMealType(found.mealType);
        setTime(found.eatenAt ? new Date(found.eatenAt).toTimeString().slice(0, 5) : "");
        setNote(found.note ?? "");
        setItems(found.items.length ? found.items.map(fromItem) : [emptyItem()]);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "读取这餐失败"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialDate, initialPartner, mealId]);

  const caloriePreview = useMemo(() => {
    const parsed = items.map((item) => numberOrNull(item.caloriesKcal));
    const valid = parsed.every((value) => value === null || (!Number.isNaN(value) && Number.isInteger(value)));
    const complete = valid && parsed.length > 0 && parsed.every((value) => value !== null);
    return complete
      ? parsed.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
  }, [items]);

  function updateItem(itemKey: string, patch: Partial<ItemDraft>) {
    setItems((current) => current.map((item) => item.key === itemKey ? { ...item, ...patch } : item));
  }

  async function save() {
    setError(null);
    if (!items.length || items.some((item) => !item.rawName.trim())) {
      setError("每个食物明细都需要填写名称");
      return;
    }

    const parsedItems: MealWritePayload["items"] = [];
    for (const item of items) {
      const calories = numberOrNull(item.caloriesKcal);
      const carbs = numberOrNull(item.carbsG);
      const protein = numberOrNull(item.proteinG);
      const fat = numberOrNull(item.fatG);
      if ([calories, carbs, protein, fat].some((value) => Number.isNaN(value))) {
        setError("营养数值只能填写 0 或更大的数字");
        return;
      }
      if (calories != null && !Number.isInteger(calories)) {
        setError("热量如果填写，需要使用整数 kcal");
        return;
      }
      parsedItems.push({
        foodId: null,
        rawName: item.rawName.trim(),
        displayName: item.rawName.trim(),
        portionDescription: item.portionDescription.trim() || null,
        estimatedWeightG: null,
        caloriesKcal: calories,
        calorieMinKcal: null,
        calorieMaxKcal: null,
        proteinG: protein,
        carbsG: carbs,
        fatG: fat,
      });
    }

    const allCaloriesKnown = parsedItems.every((item) => item.caloriesKcal !== null);
    const totalCaloriesKcal = allCaloriesKnown
      ? parsedItems.reduce((sum, item) => sum + (item.caloriesKcal ?? 0), 0)
      : null;

    const payload: MealWritePayload = {
      partnerKey,
      mealDate: date,
      mealType,
      eatenAt: dateTimeWithLocalOffset(date, time),
      snackPeriod: null,
      status: "confirmed",
      source: meal?.source ?? "manual",
      totalCaloriesKcal,
      calorieMinKcal: null,
      calorieMaxKcal: null,
      note: note.trim() || null,
      idempotencyKey: meal?.idempotencyKey ?? null,
      items: parsedItems,
    };

    setSaving(true);
    try {
      if (meal) await updateMealRecord(meal.id, payload);
      else await createMealRecord(payload);
      router.push("/food");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof MealApiError ? cause.message : "这餐暂时没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppPageShell title={meal ? "编辑一餐" : "添加一餐"} subtitle="只要记下吃了什么就能保存；热量和三大营养素都可以以后再补。">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/food" className="text-sm font-bold text-[var(--life-teal-strong)]">← 返回饮食</Link>
        <span className="text-xs text-[var(--life-text-muted)]">{loading ? "读取中…" : meal ? "修改现有记录" : "新记录"}</span>
      </div>

      <div className="grid gap-3">
        <section className="life-surface life-section-card grid gap-3">
          <AppRoleSwitch value={role} onChange={setRole} />
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">
              日期
              <AppInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">
              时间（可选）
              <AppInput type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[var(--life-text-body)]">餐次</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mealType === option.value}
                  onClick={() => setMealType(option.value)}
                  className={`rounded-xl px-2 py-2 text-xs font-extrabold ${mealType === option.value ? "bg-[var(--life-mint)] text-[#255f4d]" : "bg-[var(--life-surface-soft)] text-[var(--life-text-body)]"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {items.map((item, index) => (
          <section key={item.key} className="life-surface life-section-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-extrabold text-[var(--life-text)]">食物 {index + 1}</p>
              {items.length > 1 ? (
                <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.key !== item.key))} className="text-xs font-bold text-[var(--life-danger)]">移除</button>
              ) : null}
            </div>
            <div className="grid gap-2.5">
              <AppInput placeholder="食物名称，例如：米饭、鸡胸肉" value={item.rawName} onChange={(event) => updateItem(item.key, { rawName: event.target.value })} />
              <AppInput placeholder="份量描述（可选），例如：一小碗" value={item.portionDescription} onChange={(event) => updateItem(item.key, { portionDescription: event.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <AppInput inputMode="numeric" placeholder="热量 kcal（可选）" value={item.caloriesKcal} onChange={(event) => updateItem(item.key, { caloriesKcal: event.target.value })} />
                <AppInput inputMode="decimal" placeholder="碳水 g（可选）" value={item.carbsG} onChange={(event) => updateItem(item.key, { carbsG: event.target.value })} />
                <AppInput inputMode="decimal" placeholder="蛋白质 g（可选）" value={item.proteinG} onChange={(event) => updateItem(item.key, { proteinG: event.target.value })} />
                <AppInput inputMode="decimal" placeholder="脂肪 g（可选）" value={item.fatG} onChange={(event) => updateItem(item.key, { fatG: event.target.value })} />
              </div>
            </div>
          </section>
        ))}

        <button type="button" onClick={() => setItems((current) => [...current, emptyItem()])} className="life-feature-tile justify-center text-sm font-extrabold text-[var(--life-teal-strong)]">＋ 添加一种食物</button>

        <section className="life-surface life-section-card grid gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--life-text-body)]">当前总热量</span>
            <strong className="text-lg tabular-nums text-[var(--life-text)]">{caloriePreview == null ? "未估算" : `${caloriePreview} kcal`}</strong>
          </div>
          <p className="text-[10px] text-[var(--life-text-muted)]">留空表示“没有估算”，不会被当成 0 kcal。</p>
          <AppTextarea rows={3} placeholder="备注（可选）" value={note} onChange={(event) => setNote(event.target.value)} />
        </section>

        {error ? <div className="rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_16%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">{error}</div> : null}
        <AppButton variant="primary" disabled={saving || loading} onClick={() => void save()}>{saving ? "保存中…" : "保存这餐"}</AppButton>
      </div>
    </AppPageShell>
  );
}
