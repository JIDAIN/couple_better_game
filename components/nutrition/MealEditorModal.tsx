"use client";

import { useEffect, useMemo, useState } from "react";
import { Title } from "animal-island-ui";
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppRoleAvatar,
  AppTextarea,
} from "../ui";
import {
  createMealRecord,
  MealApiError,
  updateMealRecord,
} from "../../lib/nutrition/meal-client";
import type {
  MealItemRecord,
  MealRecord,
  MealType,
  MealWritePayload,
  NutritionPartnerKey,
  SnackPeriod,
} from "../../lib/nutrition/meal-service";

type MealEditorModalProps = {
  open: boolean;
  meal: MealRecord | null;
  initialPartner: NutritionPartnerKey;
  initialDate: string;
  onClose: () => void;
  onSaved: (meal: MealRecord) => void;
  onRequestDelete: (meal: MealRecord) => void;
};

type MealItemDraft = {
  key: string;
  foodId: string | null;
  rawName: string;
  displayName: string;
  portionDescription: string;
  estimatedWeightG: number | null;
  caloriesKcal: string;
  calorieMinKcal: string;
  calorieMaxKcal: string;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

type MealDraft = {
  partnerKey: NutritionPartnerKey;
  mealDate: string;
  mealType: MealType;
  eatenTime: string;
  snackPeriod: SnackPeriod | null;
  note: string;
  status: MealRecord["status"];
  source: MealRecord["source"];
  idempotencyKey: string;
  items: MealItemDraft[];
};

const MEAL_TYPES: Array<{ value: MealType; label: string }> = [
  { value: "breakfast", label: "早餐" },
  { value: "lunch", label: "午餐" },
  { value: "dinner", label: "晚餐" },
  { value: "snack", label: "加餐" },
  { value: "other", label: "其他" },
];

const SNACK_PERIODS: Array<{ value: SnackPeriod; label: string }> = [
  { value: "morning", label: "上午" },
  { value: "afternoon", label: "下午" },
  { value: "evening", label: "晚上" },
  { value: "late_night", label: "夜间" },
];

function makeKey(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyItem(): MealItemDraft {
  return {
    key: makeKey("meal-item"),
    foodId: null,
    rawName: "",
    displayName: "",
    portionDescription: "",
    estimatedWeightG: null,
    caloriesKcal: "",
    calorieMinKcal: "",
    calorieMaxKcal: "",
    proteinG: null,
    carbsG: null,
    fatG: null,
  };
}

function itemToDraft(item: MealItemRecord): MealItemDraft {
  return {
    key: item.id,
    foodId: item.foodId,
    rawName: item.rawName,
    displayName: item.displayName,
    portionDescription: item.portionDescription ?? "",
    estimatedWeightG: item.estimatedWeightG,
    caloriesKcal: String(item.caloriesKcal),
    calorieMinKcal:
      item.calorieMinKcal == null ? "" : String(item.calorieMinKcal),
    calorieMaxKcal:
      item.calorieMaxKcal == null ? "" : String(item.calorieMaxKcal),
    proteinG: item.proteinG,
    carbsG: item.carbsG,
    fatG: item.fatG,
  };
}

function localTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function initialDraft(
  meal: MealRecord | null,
  partnerKey: NutritionPartnerKey,
  mealDate: string,
): MealDraft {
  if (meal) {
    return {
      partnerKey: meal.partnerKey,
      mealDate: meal.mealDate,
      mealType: meal.mealType,
      eatenTime: localTimeInput(meal.eatenAt),
      snackPeriod: meal.snackPeriod,
      note: meal.note ?? "",
      status: meal.status,
      source: meal.source,
      idempotencyKey: meal.idempotencyKey ?? "",
      items: meal.items.length > 0 ? meal.items.map(itemToDraft) : [emptyItem()],
    };
  }

  return {
    partnerKey,
    mealDate,
    mealType: "lunch",
    eatenTime: "",
    snackPeriod: null,
    note: "",
    status: "confirmed",
    source: "manual",
    idempotencyKey: makeKey("web-meal"),
    items: [emptyItem()],
  };
}

function optionalInteger(value: string, label: string) {
  const text = value.trim();
  if (!text) return { ok: true as const, value: null };
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) {
    return { ok: false as const, reason: `${label}要填写 0 或更大的整数` };
  }
  return { ok: true as const, value: number };
}

function requiredInteger(value: string, label: string) {
  const parsed = optionalInteger(value, label);
  if (!parsed.ok) return parsed;
  if (parsed.value == null) {
    return { ok: false as const, reason: `${label}还没有填写` };
  }
  return { ok: true as const, value: parsed.value };
}

function dateTimeWithLocalOffset(mealDate: string, time: string) {
  if (!time) return null;
  const local = new Date(`${mealDate}T${time}:00`);
  if (Number.isNaN(local.getTime())) return null;
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `${mealDate}T${time}:00${sign}${hours}:${minutes}`;
}

function buildPayload(draft: MealDraft) {
  if (!draft.mealDate) {
    return { ok: false as const, reason: "请选择记录日期" };
  }
  if (draft.items.length === 0) {
    return { ok: false as const, reason: "至少记录一种食物" };
  }

  const items: MealWritePayload["items"] = [];
  for (const [index, item] of draft.items.entries()) {
    const rawName = item.rawName.trim();
    if (!rawName) {
      return { ok: false as const, reason: `第 ${index + 1} 项还没有填写食物名称` };
    }
    const calories = requiredInteger(item.caloriesKcal, `第 ${index + 1} 项热量`);
    if (!calories.ok) return calories;
    const calorieMin = optionalInteger(item.calorieMinKcal, `第 ${index + 1} 项热量下限`);
    if (!calorieMin.ok) return calorieMin;
    const calorieMax = optionalInteger(item.calorieMaxKcal, `第 ${index + 1} 项热量上限`);
    if (!calorieMax.ok) return calorieMax;

    if (
      calorieMin.value != null &&
      calorieMax.value != null &&
      calorieMin.value > calorieMax.value
    ) {
      return { ok: false as const, reason: `第 ${index + 1} 项的热量区间上下限颠倒了` };
    }
    if (calorieMin.value != null && calories.value < calorieMin.value) {
      return { ok: false as const, reason: `第 ${index + 1} 项估算热量低于区间下限` };
    }
    if (calorieMax.value != null && calories.value > calorieMax.value) {
      return { ok: false as const, reason: `第 ${index + 1} 项估算热量高于区间上限` };
    }

    items.push({
      foodId: item.foodId,
      rawName,
      displayName: item.displayName.trim() || rawName,
      portionDescription: item.portionDescription.trim() || null,
      estimatedWeightG: item.estimatedWeightG,
      caloriesKcal: calories.value,
      calorieMinKcal: calorieMin.value,
      calorieMaxKcal: calorieMax.value,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
    });
  }

  const totalCaloriesKcal = items.reduce((sum, item) => sum + item.caloriesKcal, 0);
  const calorieMinKcal = items.every((item) => item.calorieMinKcal != null)
    ? items.reduce((sum, item) => sum + (item.calorieMinKcal ?? 0), 0)
    : null;
  const calorieMaxKcal = items.every((item) => item.calorieMaxKcal != null)
    ? items.reduce((sum, item) => sum + (item.calorieMaxKcal ?? 0), 0)
    : null;

  const payload: MealWritePayload = {
    partnerKey: draft.partnerKey,
    mealDate: draft.mealDate,
    mealType: draft.mealType,
    eatenAt: dateTimeWithLocalOffset(draft.mealDate, draft.eatenTime),
    snackPeriod: draft.mealType === "snack" ? draft.snackPeriod : null,
    status: draft.status,
    source: draft.source,
    totalCaloriesKcal,
    calorieMinKcal,
    calorieMaxKcal,
    note: draft.note.trim() || null,
    idempotencyKey: draft.idempotencyKey || null,
    items,
  };

  return { ok: true as const, payload };
}

export function MealEditorModal({
  open,
  meal,
  initialPartner,
  initialDate,
  onClose,
  onSaved,
  onRequestDelete,
}: MealEditorModalProps) {
  const [draft, setDraft] = useState<MealDraft>(() =>
    initialDraft(meal, initialPartner, initialDate),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft(meal, initialPartner, initialDate));
    setSaving(false);
    setError(null);
  }, [open, meal, initialPartner, initialDate]);

  const previewTotal = useMemo(
    () =>
      draft.items.reduce((sum, item) => {
        const value = Number(item.caloriesKcal);
        return Number.isInteger(value) && value >= 0 ? sum + value : sum;
      }, 0),
    [draft.items],
  );

  function updateItem(key: string, patch: Partial<MealItemDraft>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.key === key ? { ...item, ...patch } : item,
      ),
    }));
  }

  async function submit() {
    const parsed = buildPayload(draft);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = meal
        ? await updateMealRecord(meal.id, parsed.payload)
        : await createMealRecord(parsed.payload);
      onSaved(saved);
    } catch (caught) {
      setError(
        caught instanceof MealApiError
          ? caught.message
          : "这餐暂时没有保存成功，请稍后再试",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      maskClosable={!saving}
      width="min(94vw, 32rem)"
      title={
        <div className="app-dialog-header shrink-0">
          <p className="text-[10px] font-bold tracking-[0.2em] ui-text-primary">
            饮食小记
          </p>
          <Title size="small" color="app-yellow" className="mt-1">
            {meal ? "编辑这餐" : "记一餐"}
          </Title>
          <p className="mt-1 text-xs font-medium ui-text-muted">
            只记录实际吃了什么，不会自动改游戏缺口
          </p>
        </div>
      }
      footer={null}
    >
      <div className="app-modal-scroll-body max-h-[72dvh] space-y-3 overflow-y-auto pr-1">
        <div>
          <span className="ui-field-label">记录人</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {(["fish", "cat"] as const).map((role) => (
              <AppButton
                key={role}
                type="button"
                aria-pressed={draft.partnerKey === role}
                disabled={saving}
                onClick={() => setDraft((current) => ({ ...current, partnerKey: role }))}
                className={`${draft.partnerKey === role ? "is-primary" : "is-secondary"} w-full py-2 text-xs font-semibold`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <AppRoleAvatar role={role} size={16} />
                  {role === "fish" ? "鱼鱼" : "猫猫"}
                </span>
              </AppButton>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block min-w-0">
            <span className="ui-field-label">日期</span>
            <AppInput
              type="date"
              value={draft.mealDate}
              disabled={saving}
              onChange={(event) =>
                setDraft((current) => ({ ...current, mealDate: event.target.value }))
              }
              className="mt-1 w-full px-3 py-2.5 text-sm font-semibold"
            />
          </label>
          <label className="block min-w-0">
            <span className="ui-field-label">时间（可选）</span>
            <AppInput
              type="time"
              value={draft.eatenTime}
              disabled={saving}
              onChange={(event) =>
                setDraft((current) => ({ ...current, eatenTime: event.target.value }))
              }
              className="mt-1 w-full px-3 py-2.5 text-sm font-semibold"
            />
          </label>
        </div>

        <div>
          <span className="ui-field-label">餐次</span>
          <div className="mt-1 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {MEAL_TYPES.map((option) => (
              <AppButton
                key={option.value}
                type="button"
                disabled={saving}
                aria-pressed={draft.mealType === option.value}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    mealType: option.value,
                    snackPeriod: option.value === "snack" ? current.snackPeriod : null,
                  }))
                }
                className={`${draft.mealType === option.value ? "is-primary" : "is-secondary"} w-full px-1.5 py-2 text-[11px] font-semibold`}
              >
                {option.label}
              </AppButton>
            ))}
          </div>
        </div>

        {draft.mealType === "snack" ? (
          <div>
            <span className="ui-field-label">加餐时段（可选）</span>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {SNACK_PERIODS.map((option) => (
                <AppButton
                  key={option.value}
                  type="button"
                  disabled={saving}
                  aria-pressed={draft.snackPeriod === option.value}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      snackPeriod:
                        current.snackPeriod === option.value ? null : option.value,
                    }))
                  }
                  className={`${draft.snackPeriod === option.value ? "is-primary" : "is-secondary"} w-full px-1 py-2 text-[10px] font-semibold`}
                >
                  {option.label}
                </AppButton>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="ui-field-label">食物明细</p>
              <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
                当前合计约 {previewTotal} kcal
              </p>
            </div>
            <AppButton
              type="button"
              disabled={saving}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  items: [...current.items, emptyItem()],
                }))
              }
              className="is-secondary px-2.5 py-1.5 text-[11px] font-semibold"
            >
              + 再加一样
            </AppButton>
          </div>

          {draft.items.map((item, index) => (
            <AppCard key={item.key} variant="item" className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold ui-text-main">食物 {index + 1}</p>
                {draft.items.length > 1 ? (
                  <AppButton
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        items: current.items.filter((candidate) => candidate.key !== item.key),
                      }))
                    }
                    className="is-ghost px-2 py-1 text-[10px] font-semibold"
                  >
                    移除
                  </AppButton>
                ) : null}
              </div>

              <label className="mt-2 block">
                <span className="ui-field-label">吃了什么</span>
                <AppInput
                  value={item.rawName}
                  disabled={saving}
                  placeholder="例如：米饭、烧鸡、哈密瓜"
                  onChange={(event) => {
                    const rawName = event.target.value;
                    updateItem(item.key, {
                      rawName,
                      displayName:
                        !item.displayName || item.displayName === item.rawName
                          ? rawName
                          : item.displayName,
                    });
                  }}
                  className="mt-1 w-full px-3 py-2.5 text-sm font-semibold"
                />
              </label>

              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                <label className="block min-w-0">
                  <span className="ui-field-label">份量（可选）</span>
                  <AppInput
                    value={item.portionDescription}
                    disabled={saving}
                    placeholder="一小碗 / 两块"
                    onChange={(event) =>
                      updateItem(item.key, { portionDescription: event.target.value })
                    }
                    className="mt-1 w-full px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="ui-field-label">估算 kcal</span>
                  <AppInput
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={item.caloriesKcal}
                    disabled={saving}
                    onChange={(event) =>
                      updateItem(item.key, { caloriesKcal: event.target.value })
                    }
                    className="mt-1 w-full px-3 py-2.5 text-sm font-semibold tabular-nums"
                  />
                </label>
              </div>

              <details className="mt-2 text-[11px] font-medium ui-text-muted">
                <summary className="cursor-pointer select-none font-semibold ui-text-primary">
                  热量区间（可选）
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block min-w-0">
                    <span className="ui-field-label">下限 kcal</span>
                    <AppInput
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={item.calorieMinKcal}
                      disabled={saving}
                      onChange={(event) =>
                        updateItem(item.key, { calorieMinKcal: event.target.value })
                      }
                      className="mt-1 w-full px-3 py-2 text-sm tabular-nums"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="ui-field-label">上限 kcal</span>
                    <AppInput
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={item.calorieMaxKcal}
                      disabled={saving}
                      onChange={(event) =>
                        updateItem(item.key, { calorieMaxKcal: event.target.value })
                      }
                      className="mt-1 w-full px-3 py-2 text-sm tabular-nums"
                    />
                  </label>
                </div>
              </details>
            </AppCard>
          ))}
        </div>

        <label className="block">
          <span className="ui-field-label">备注（可选）</span>
          <AppTextarea
            value={draft.note}
            disabled={saving}
            maxLength={2000}
            rows={3}
            placeholder="例如：食堂午餐、和朋友一起吃"
            onChange={(event) =>
              setDraft((current) => ({ ...current, note: event.target.value }))
            }
            className="mt-1 w-full px-3 py-2.5 text-sm"
          />
        </label>

        {error ? (
          <AppCard variant="soft" className="px-3 py-2.5" role="alert">
            <p className="text-xs font-semibold ui-text-danger">{error}</p>
          </AppCard>
        ) : null}

        <div className="app-dialog-footer app-dialog-footer--inline">
          {meal ? (
            <AppButton
              type="button"
              disabled={saving}
              onClick={() => onRequestDelete(meal)}
              className="is-danger px-3 py-3 text-xs font-semibold"
            >
              删除这餐
            </AppButton>
          ) : null}
          <AppButton
            type="button"
            disabled={saving}
            onClick={onClose}
            className="is-secondary flex-1 py-3 text-sm font-semibold"
          >
            取消
          </AppButton>
          <AppButton
            type="button"
            disabled={saving}
            onClick={submit}
            className="is-primary flex-[1.35] py-3 text-sm font-semibold"
          >
            {saving ? "正在保存…" : meal ? "保存修改" : "记下这餐"}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}
