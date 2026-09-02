"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Title } from "animal-island-ui";
import { selectDailyGameOverview, type DailyGameOverview } from "../../lib/home/daily-overview-service";
import {
  deleteMealRecord,
  fetchMeals,
  MealApiError,
} from "../../lib/nutrition/meal-client";
import type {
  MealRecord,
  MealType,
  NutritionPartnerKey,
  SnackPeriod,
} from "../../lib/nutrition/meal-service";
import { useHomeResources } from "../home/HomeResourcesProvider";
import {
  AppButton,
  AppCard,
  AppInput,
  AppModal,
  AppRoleAvatar,
  AppSectionPanel,
  AppToast,
} from "../ui";
import { MealEditorModal } from "./MealEditorModal";

const MEAL_ORDER: Record<MealType, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
  snack: 3,
  other: 4,
};

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
  other: "其他",
};

const SNACK_LABEL: Record<SnackPeriod, string> = {
  morning: "上午加餐",
  afternoon: "下午加餐",
  evening: "晚间加餐",
  late_night: "夜间加餐",
};

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mealLabel(meal: MealRecord) {
  if (meal.mealType === "snack" && meal.snackPeriod) {
    return SNACK_LABEL[meal.snackPeriod];
  }
  return MEAL_LABEL[meal.mealType];
}

function mealTime(meal: MealRecord) {
  if (!meal.eatenAt) return null;
  const date = new Date(meal.eatenAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function calorieText(meal: MealRecord) {
  if (meal.calorieMinKcal != null && meal.calorieMaxKcal != null) {
    return `${meal.totalCaloriesKcal} kcal（${meal.calorieMinKcal}–${meal.calorieMaxKcal}）`;
  }
  return `${meal.totalCaloriesKcal} kcal`;
}

function sourceLabel(meal: MealRecord) {
  if (meal.source === "chatgpt") return "ChatGPT 记录";
  if (meal.source === "import") return "导入记录";
  return null;
}

function sortMeals(meals: MealRecord[]) {
  return [...meals].sort((a, b) => {
    const mealOrder = MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType];
    if (mealOrder !== 0) return mealOrder;
    const aTime = a.eatenAt ?? a.createdAt;
    const bTime = b.eatenAt ?? b.createdAt;
    return aTime.localeCompare(bTime);
  });
}

function totalCalorieRange(meals: MealRecord[]) {
  if (
    meals.length === 0 ||
    meals.some((meal) => meal.calorieMinKcal == null || meal.calorieMaxKcal == null)
  ) {
    return null;
  }

  return meals.reduce(
    (range, meal) => ({
      min: range.min + (meal.calorieMinKcal ?? 0),
      max: range.max + (meal.calorieMaxKcal ?? 0),
    }),
    { min: 0, max: 0 },
  );
}

function mealLoadError(caught: unknown) {
  if (caught instanceof MealApiError && caught.status === 401) {
    return "还没有连接云端，请先到「小窝 → 数据管理」连接云端后再记录饮食";
  }
  return caught instanceof MealApiError
    ? caught.message
    : "饮食记录暂时没有加载出来，请稍后再试";
}

function LinkedDailySummary({
  selectedPartner,
  meals,
  totalCalories,
  totalRange,
  gameOverview,
  loading,
  error,
}: {
  selectedPartner: NutritionPartnerKey;
  meals: MealRecord[];
  totalCalories: number;
  totalRange: { min: number; max: number } | null;
  gameOverview: DailyGameOverview;
  loading: boolean;
  error: string | null;
}) {
  const intakeText = loading
    ? "加载中…"
    : error
      ? "暂未加载"
      : meals.length === 0
        ? "未记录"
        : `${totalCalories} kcal`;
  const intakeDetail =
    !loading && !error && meals.length > 0 && totalRange
      ? `估算区间 ${totalRange.min}–${totalRange.max}`
      : !loading && !error && meals.length > 0
        ? `${meals.length} 餐已记录`
        : null;

  return (
    <AppCard variant="soft" className="px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold ui-text-main">当天合在一起看</p>
          <p className="mt-0.5 text-[10px] font-medium ui-text-soft">
            按同一角色和日期关联，不会互相自动改值
          </p>
        </div>
        <AppRoleAvatar role={selectedPartner} size={24} />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white/55 px-3 py-2.5">
          <p className="text-[10px] font-semibold ui-text-soft">实际摄入</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums ui-text-reward">
            {intakeText}
          </p>
          {intakeDetail ? (
            <p className="mt-0.5 text-[10px] font-medium tabular-nums ui-text-muted">
              {intakeDetail}
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-white/55 px-3 py-2.5">
          <p className="text-[10px] font-semibold ui-text-soft">游戏热量缺口</p>
          <p className="mt-0.5 text-sm font-bold tabular-nums ui-text-primary">
            {gameOverview.hasRecord ? `${gameOverview.deficitKcal ?? 0} kcal` : "未记录"}
          </p>
          {gameOverview.hasRecord ? (
            <p className="mt-0.5 text-[10px] font-medium ui-text-muted">游戏打卡字段</p>
          ) : null}
        </div>
      </div>

      {gameOverview.hasRecord ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold ui-text-muted">
          <span className="tabular-nums">
            运动 {gameOverview.exerciseMinutes ?? 0} 分钟
          </span>
          <span className="tabular-nums">
            体重 {gameOverview.weightKg == null ? "未填" : `${gameOverview.weightKg} kg`}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-[10px] font-semibold ui-text-muted">
          当天游戏记录未填写；饮食会保留，不会自动补写游戏记录。
        </p>
      )}
    </AppCard>
  );
}

function MealCard({ meal, onEdit }: { meal: MealRecord; onEdit: () => void }) {
  const time = mealTime(meal);
  const source = sourceLabel(meal);
  const macroParts = meal.items.reduce(
    (totals, item) => ({
      protein: totals.protein + (item.proteinG ?? 0),
      carbs: totals.carbs + (item.carbsG ?? 0),
      fat: totals.fat + (item.fatG ?? 0),
      hasProtein: totals.hasProtein || item.proteinG != null,
      hasCarbs: totals.hasCarbs || item.carbsG != null,
      hasFat: totals.hasFat || item.fatG != null,
    }),
    {
      protein: 0,
      carbs: 0,
      fat: 0,
      hasProtein: false,
      hasCarbs: false,
      hasFat: false,
    },
  );

  const macroText = [
    macroParts.hasProtein ? `蛋白质 ${macroParts.protein.toFixed(1)}g` : null,
    macroParts.hasCarbs ? `碳水 ${macroParts.carbs.toFixed(1)}g` : null,
    macroParts.hasFat ? `脂肪 ${macroParts.fat.toFixed(1)}g` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppCard variant="item" className="p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-bold ui-text-main">{mealLabel(meal)}</p>
            {time ? (
              <span className="text-[11px] font-semibold tabular-nums ui-text-soft">
                {time}
              </span>
            ) : null}
            {source ? (
              <span className="text-[10px] font-semibold ui-text-primary">{source}</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-bold tabular-nums ui-text-reward">
            {calorieText(meal)}
          </p>
          {meal.note ? (
            <p className="mt-1 line-clamp-2 text-[11px] font-medium ui-text-muted">
              {meal.note}
            </p>
          ) : null}
        </div>
        <AppButton
          type="button"
          onClick={onEdit}
          className="is-secondary shrink-0 px-2.5 py-1.5 text-[11px] font-semibold"
        >
          编辑
        </AppButton>
      </div>

      <details className="mt-2 border-t border-black/5 pt-2 text-[11px] font-medium ui-text-muted">
        <summary className="cursor-pointer select-none font-semibold ui-text-primary">
          食物明细 {meal.items.length} 项
        </summary>
        <div className="mt-2 space-y-2">
          {meal.items.length === 0 ? (
            <p className="ui-text-soft">这餐没有单独的食物明细</p>
          ) : (
            meal.items.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold ui-text-main">
                    {item.displayName || item.rawName}
                  </p>
                  {item.portionDescription || item.estimatedWeightG != null ? (
                    <p className="mt-0.5 ui-text-soft">
                      {[
                        item.portionDescription,
                        item.estimatedWeightG != null
                          ? `约 ${item.estimatedWeightG}g`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-semibold ui-text-main">{item.caloriesKcal} kcal</p>
                  {item.calorieMinKcal != null && item.calorieMaxKcal != null ? (
                    <p className="ui-text-soft">
                      {item.calorieMinKcal}–{item.calorieMaxKcal}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {macroText ? <p className="pt-1 ui-text-soft">{macroText}</p> : null}
        </div>
      </details>
    </AppCard>
  );
}

export function DailyMealsPanel() {
  const { dailyRecords } = useHomeResources();
  const today = useMemo(() => localIsoDate(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedPartner, setSelectedPartner] =
    useState<NutritionPartnerKey>("fish");
  const [meals, setMeals] = useState<MealRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorMeal, setEditorMeal] = useState<MealRecord | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MealRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadMeals = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const records = await fetchMeals({
        mealDate: selectedDate,
        partnerKey: selectedPartner,
      });
      if (requestId !== requestIdRef.current) return;
      setMeals(sortMeals(records));
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setMeals([]);
      setError(mealLoadError(caught));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [selectedDate, selectedPartner]);

  useEffect(() => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    let cancelled = false;

    void fetchMeals({
      mealDate: selectedDate,
      partnerKey: selectedPartner,
    })
      .then((records) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setMeals(sortMeals(records));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setMeals([]);
        setError(mealLoadError(caught));
      })
      .finally(() => {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedPartner]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totalCalories = useMemo(
    () => meals.reduce((sum, meal) => sum + meal.totalCaloriesKcal, 0),
    [meals],
  );
  const totalRange = useMemo(() => totalCalorieRange(meals), [meals]);
  const gameOverview = useMemo(
    () => selectDailyGameOverview(dailyRecords, selectedDate, selectedPartner),
    [dailyRecords, selectedDate, selectedPartner],
  );

  function selectDate(date: string) {
    setLoading(true);
    setError(null);
    setSelectedDate(date);
  }

  function selectPartner(partner: NutritionPartnerKey) {
    setLoading(true);
    setError(null);
    setSelectedPartner(partner);
  }

  function openCreate() {
    setEditorMeal(null);
    setEditorOpen(true);
  }

  function openEdit(meal: MealRecord) {
    setEditorMeal(meal);
    setEditorOpen(true);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteMealRecord(pendingDelete.id);
      setPendingDelete(null);
      setToast("这餐已经删除");
      await loadMeals();
    } catch (caught) {
      setToast(
        caught instanceof MealApiError ? caught.message : "这餐暂时没有删除成功",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AppSectionPanel title="饮食小记" icon="notebook" className="space-y-3">
        <p className="text-[11px] font-medium leading-relaxed ui-text-muted">
          这里记的是实际摄入；下面会把同一天的游戏记录一起展示，但不会用饮食自动修改游戏热量缺口。
        </p>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2.5">
          <label className="block min-w-0">
            <span className="ui-field-label">日期</span>
            <AppInput
              type="date"
              value={selectedDate}
              max={today}
              onChange={(event) => selectDate(event.target.value)}
              className="mt-1 w-full px-2.5 py-2 text-xs font-semibold"
            />
          </label>

          <div className="min-w-0">
            <span className="ui-field-label">记录人</span>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {(["fish", "cat"] as const).map((role) => (
                <AppButton
                  key={role}
                  type="button"
                  aria-pressed={selectedPartner === role}
                  onClick={() => selectPartner(role)}
                  className={`${selectedPartner === role ? "is-primary" : "is-secondary"} w-full px-1.5 py-2 text-[11px] font-semibold`}
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    <AppRoleAvatar role={role} size={14} />
                    {role === "fish" ? "鱼鱼" : "猫猫"}
                  </span>
                </AppButton>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-xs font-bold ui-text-main">
              {loading ? "正在翻饮食小记…" : `${meals.length} 餐 · ${totalCalories} kcal`}
            </p>
            <p className="mt-0.5 text-[10px] font-medium ui-text-soft">
              {selectedDate === today ? "今天" : selectedDate} · {selectedPartner === "fish" ? "鱼鱼" : "猫猫"}
            </p>
          </div>
          <AppButton
            type="button"
            onClick={openCreate}
            className="is-primary shrink-0 px-3 py-2 text-xs font-semibold"
          >
            记一餐
          </AppButton>
        </div>

        <LinkedDailySummary
          selectedPartner={selectedPartner}
          meals={meals}
          totalCalories={totalCalories}
          totalRange={totalRange}
          gameOverview={gameOverview}
          loading={loading}
          error={error}
        />

        {error ? (
          <AppCard variant="soft" className="px-3 py-3" role="alert">
            <p className="text-xs font-semibold leading-relaxed ui-text-muted">{error}</p>
            <AppButton
              type="button"
              onClick={() => void loadMeals()}
              className="is-secondary mt-2 px-3 py-1.5 text-[11px] font-semibold"
            >
              再试一次
            </AppButton>
          </AppCard>
        ) : loading ? (
          <AppCard variant="item" className="px-3 py-4 text-center">
            <p className="text-xs font-semibold ui-text-muted">正在加载这一天的饮食记录…</p>
          </AppCard>
        ) : meals.length === 0 ? (
          <AppCard variant="item" className="px-3 py-4 text-center">
            <p className="text-xs font-semibold ui-text-muted">这一天还没有饮食记录</p>
            <p className="mt-1 text-[11px] font-medium ui-text-soft">
              吃完以后再记也可以，不需要和游戏打卡一起完成。
            </p>
          </AppCard>
        ) : (
          <div className="space-y-2">
            {meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} onEdit={() => openEdit(meal)} />
            ))}
          </div>
        )}
      </AppSectionPanel>

      {editorOpen ? (
        <MealEditorModal
          key={editorMeal?.id ?? `new-${selectedPartner}-${selectedDate}`}
          open
          meal={editorMeal}
          initialPartner={selectedPartner}
          initialDate={selectedDate}
          onClose={() => setEditorOpen(false)}
          onSaved={(saved) => {
            setEditorOpen(false);
            setToast(editorMeal ? "这餐已经更新" : "这餐已经记下");
            if (saved.partnerKey !== selectedPartner || saved.mealDate !== selectedDate) {
              setLoading(true);
              setError(null);
              setSelectedPartner(saved.partnerKey);
              setSelectedDate(saved.mealDate);
            } else {
              void loadMeals();
            }
          }}
          onRequestDelete={(meal) => {
            setEditorOpen(false);
            setPendingDelete(meal);
          }}
        />
      ) : null}

      <AppModal
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        maskClosable={!deleting}
        width="min(90vw, 24rem)"
        title={
          <div className="app-dialog-header">
            <Title size="small" color="app-yellow">
              删除这餐？
            </Title>
            <p className="mt-1 text-xs font-medium ui-text-muted">
              删除后会从饮食记录里移除，但不会影响游戏缺口或奖励。
            </p>
          </div>
        }
        footer={null}
      >
        <div className="space-y-3">
          {pendingDelete ? (
            <AppCard variant="item" className="px-3 py-3">
              <p className="text-sm font-bold ui-text-main">{mealLabel(pendingDelete)}</p>
              <p className="mt-1 text-xs font-semibold tabular-nums ui-text-reward">
                {calorieText(pendingDelete)}
              </p>
            </AppCard>
          ) : null}
          <div className="app-dialog-footer app-dialog-footer--inline">
            <AppButton
              type="button"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
              className="is-secondary flex-1 py-3 text-sm font-semibold"
            >
              保留
            </AppButton>
            <AppButton
              type="button"
              disabled={deleting}
              onClick={() => void confirmDelete()}
              className="is-danger flex-1 py-3 text-sm font-semibold"
            >
              {deleting ? "正在删除…" : "确认删除"}
            </AppButton>
          </div>
        </div>
      </AppModal>

      {toast ? (
        <AppToast className="pointer-events-none fixed bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-1/2 z-[70] w-[min(92vw,20rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold ui-text-main">
          {toast}
        </AppToast>
      ) : null}
    </>
  );
}