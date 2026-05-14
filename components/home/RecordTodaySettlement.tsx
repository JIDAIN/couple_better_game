"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useHomeResources } from "./HomeResourcesProvider";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  getCurrentIsoDate,
  gemsForPerson,
  isInCoinWeek,
  parseNonNegativeInt,
  parseOptionalWeight,
  type PersonKey,
  type SideLogInput,
} from "./settlement-rules";

type HistoryEditMode = "single" | "both";

function SoftField({
  label,
  hint,
  value,
  onChange,
  inputMode,
  unit,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric" | "text";
  unit?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-semibold text-stone-600">{label}</span>
      {hint ? (
        <span className="mt-0.5 block text-[10px] text-stone-400">{hint}</span>
      ) : null}
      <div className="mt-1 flex items-center gap-1.5 rounded-2xl border border-white/80 bg-white/65 px-3 py-2 shadow-inner shadow-rose-50/40 backdrop-blur-sm">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-stone-800 outline-none placeholder:text-stone-300"
          placeholder="0"
        />
        {unit ? (
          <span className="shrink-0 text-[11px] font-medium text-stone-400">
            {unit}
          </span>
        ) : null}
      </div>
    </label>
  );
}

function PartnerColumn({
  emoji,
  title,
  weight,
  setWeight,
  deficit,
  setDeficit,
  minutes,
  setMinutes,
}: {
  emoji: string;
  title: string;
  weight: string;
  setWeight: (value: string) => void;
  deficit: string;
  setDeficit: (value: string) => void;
  minutes: string;
  setMinutes: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-rose-100/70 bg-gradient-to-b from-white/75 to-rose-50/40 p-3 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b border-rose-100/50 pb-2">
        <span className="text-xl" aria-hidden>
          {emoji}
        </span>
        <div>
          <p className="text-xs font-bold text-stone-800">{title}</p>
          <p className="text-[10px] text-stone-400">轻轻填就好</p>
        </div>
      </div>
      <SoftField
        label="今日体重"
        hint="不想称也可以空着"
        value={weight}
        onChange={setWeight}
        inputMode="decimal"
        unit="kg"
      />
      <SoftField
        label="运动时长"
        value={minutes}
        onChange={setMinutes}
        inputMode="numeric"
        unit="分钟"
      />
      <SoftField
        label="热量缺口"
        value={deficit}
        onChange={setDeficit}
        inputMode="numeric"
        unit="kcal"
      />
    </div>
  );
}

function HistoryPartnerCard({
  emoji,
  title,
  deficit,
  setDeficit,
  minutes,
  setMinutes,
}: {
  emoji: string;
  title: string;
  deficit: string;
  setDeficit: (value: string) => void;
  minutes: string;
  setMinutes: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-rose-100/70 bg-white/60 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden>{emoji}</span>
        <p className="text-xs font-bold text-stone-700">{title}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <SoftField
          label="热量缺口"
          value={deficit}
          onChange={setDeficit}
          inputMode="numeric"
          unit="kcal"
        />
        <SoftField
          label="运动时长"
          value={minutes}
          onChange={setMinutes}
          inputMode="numeric"
          unit="分钟"
        />
      </div>
    </div>
  );
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function getDefaultHistoryDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateInputValue(date);
}

function parseDateInputDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return day;
}

function previousDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  date.setDate(date.getDate() - 1);
  return toDateInputValue(date);
}

function recordIsoDate(record: { recordDate?: string; day: number }) {
  return record.recordDate ?? `2026-05-${pad2(record.day)}`;
}

function totalRecordGems(record: {
  fish: { gems: number };
  cat: { gems: number };
  bonus: number;
}) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

type RecordTodayButtonVariant = "full" | "today" | "history";

type RecordTodaySettlementProps = {
  buttonVariant?: RecordTodayButtonVariant;
};

export function RecordTodaySettlement({
  buttonVariant = "full",
}: RecordTodaySettlementProps) {
  const {
    applyTodayRecord,
    coinRules,
    dailyRecords,
    upsertHistoricalRecord,
    visualRules,
    weekGemTotal,
  } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"today" | "history">("today");
  const [entered, setEntered] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const titleId = useId();

  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

  const [historyDate, setHistoryDate] = useState(getDefaultHistoryDate);
  const [historyMode, setHistoryMode] = useState<HistoryEditMode>("single");
  const [historyPerson, setHistoryPerson] = useState<PersonKey>("fish");
  const [historyFishD, setHistoryFishD] = useState("0");
  const [historyFishM, setHistoryFishM] = useState("0");
  const [historyCatD, setHistoryCatD] = useState("0");
  const [historyCatM, setHistoryCatM] = useState("0");

  const fishInput: SideLogInput = useMemo(
    () => ({
      weightKg: parseOptionalWeight(fishW),
      deficit: parseNonNegativeInt(fishD),
      minutes: parseNonNegativeInt(fishM),
    }),
    [fishD, fishM, fishW],
  );
  const catInput: SideLogInput = useMemo(
    () => ({
      weightKg: parseOptionalWeight(catW),
      deficit: parseNonNegativeInt(catD),
      minutes: parseNonNegativeInt(catM),
    }),
    [catD, catM, catW],
  );

  const maxHistoryDate = useMemo(() => toDateInputValue(new Date()), []);
  const historyFishInput: SideLogInput = useMemo(
    () => ({
      weightKg: null,
      deficit: parseNonNegativeInt(historyFishD),
      minutes: parseNonNegativeInt(historyFishM),
    }),
    [historyFishD, historyFishM],
  );
  const historyCatInput: SideLogInput = useMemo(
    () => ({
      weightKg: null,
      deficit: parseNonNegativeInt(historyCatD),
      minutes: parseNonNegativeInt(historyCatM),
    }),
    [historyCatD, historyCatM],
  );

  const historyDay = useMemo(() => parseDateInputDay(historyDate), [historyDate]);
  const existingHistoryRecord = useMemo(
    () =>
      dailyRecords.find((record) => recordIsoDate(record) === historyDate) ??
      null,
    [dailyRecords, historyDate],
  );
  const historyYesterdayRecord = useMemo(() => {
    const previousDate = previousDateInputValue(historyDate);
    if (!previousDate) return null;
    return (
      dailyRecords.find((record) => recordIsoDate(record) === previousDate) ??
      null
    );
  }, [dailyRecords, historyDate]);

  const todayDate = useMemo(() => getCurrentIsoDate(), []);
  const settlementDay = useMemo(
    () => parseDateInputDay(todayDate) ?? new Date().getDate(),
    [todayDate],
  );
  const yesterdayRecord = useMemo(() => {
    const previousDate = previousDateInputValue(todayDate);
    if (!previousDate) return null;
    return (
      dailyRecords.find((record) => recordIsoDate(record) === previousDate) ??
      null
    );
  }, [dailyRecords, todayDate]);

  const hydrateHistoryInputs = useCallback(
    (record: typeof existingHistoryRecord) => {
      setHistoryFishD(String(record?.fish.deficit ?? 0));
      setHistoryFishM(String(record?.fish.minutes ?? 0));
      setHistoryCatD(String(record?.cat.deficit ?? 0));
      setHistoryCatM(String(record?.cat.minutes ?? 0));
    },
    [],
  );

  const preview = useMemo(() => {
    const fg = gemsForPerson("fish", fishInput, yesterdayRecord);
    const cg = gemsForPerson("cat", catInput, yesterdayRecord);
    const couple = computeCoupleBonus(fishInput, catInput);
    const todayGemTotal = fg + cg + couple.gems;
    const coin = computeCoinPreview({
      fish: fishInput,
      cat: catInput,
      todayDay: settlementDay,
      todayDate,
      todayGemTotal,
      currentWeekGemTotal: weekGemTotal,
      dailyRecords,
      coinRules,
      visualRules,
    });
    return { fg, cg, couple, coin };
  }, [
    catInput,
    coinRules,
    dailyRecords,
    fishInput,
    settlementDay,
    todayDate,
    visualRules,
    weekGemTotal,
    yesterdayRecord,
  ]);

  const historyPreview = useMemo(() => {
    const zeroInput: SideLogInput = { weightKg: null, deficit: 0, minutes: 0 };
    const existingFish = existingHistoryRecord
      ? {
          weightKg: existingHistoryRecord.fish.weightKg,
          deficit: existingHistoryRecord.fish.deficit,
          minutes: existingHistoryRecord.fish.minutes,
        }
      : zeroInput;
    const existingCat = existingHistoryRecord
      ? {
          weightKg: existingHistoryRecord.cat.weightKg,
          deficit: existingHistoryRecord.cat.deficit,
          minutes: existingHistoryRecord.cat.minutes,
        }
      : zeroInput;
    const fish =
      historyMode === "both"
        ? historyFishInput
        : historyPerson === "fish"
          ? historyFishInput
          : existingFish;
    const cat =
      historyMode === "both"
        ? historyCatInput
        : historyPerson === "cat"
          ? historyCatInput
          : existingCat;
    const fg = gemsForPerson("fish", fish, historyYesterdayRecord);
    const cg = gemsForPerson("cat", cat, historyYesterdayRecord);
    const couple = computeCoupleBonus(fish, cat);
    const recordsWithoutExisting = existingHistoryRecord
      ? dailyRecords.filter((record) => record.id !== existingHistoryRecord.id)
      : dailyRecords;
    const weekGemTotalForHistory = recordsWithoutExisting.reduce(
      (total, record) =>
        isInCoinWeek(recordIsoDate(record), historyDate, coinRules.weekStartDay)
          ? total + totalRecordGems(record)
          : total,
      0,
    );
    const todayGemTotal = fg + cg + couple.gems;
    const coin = computeCoinPreview({
      fish,
      cat,
      todayDay: historyDay ?? 1,
      todayDate: historyDate,
      todayGemTotal,
      currentWeekGemTotal: weekGemTotalForHistory,
      dailyRecords: recordsWithoutExisting,
      coinRules,
      visualRules,
    });
    return { fg, cg, couple, coin };
  }, [
    coinRules,
    dailyRecords,
    existingHistoryRecord,
    historyCatInput,
    historyDate,
    historyDay,
    historyFishInput,
    historyMode,
    historyPerson,
    historyYesterdayRecord,
    visualRules,
  ]);

  const hasAnyEffort = useMemo(
    () =>
      fishInput.deficit > 0 ||
      fishInput.minutes > 0 ||
      fishInput.weightKg != null ||
      catInput.deficit > 0 ||
      catInput.minutes > 0 ||
      catInput.weightKg != null,
    [catInput, fishInput],
  );

  const hasAnyHistoryEffort = useMemo(() => {
    if (historyMode === "both") {
      return (
        historyFishInput.deficit > 0 ||
        historyFishInput.minutes > 0 ||
        historyCatInput.deficit > 0 ||
        historyCatInput.minutes > 0
      );
    }
    return historyPerson === "fish"
      ? historyFishInput.deficit > 0 || historyFishInput.minutes > 0
      : historyCatInput.deficit > 0 || historyCatInput.minutes > 0;
  }, [
    historyCatInput,
    historyFishInput,
    historyMode,
    historyPerson,
  ]);

  useEffect(() => {
    if (!open) {
      const id = requestAnimationFrame(() => setEntered(false));
      return () => cancelAnimationFrame(id);
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const onConfirm = useCallback(() => {
    if (!hasAnyEffort) return;
    applyTodayRecord({
      day: settlementDay,
      fish: fishInput,
      cat: catInput,
      fishHeat: buildHeatmapDay("fish", fishInput, visualRules),
      catHeat: buildHeatmapDay("cat", catInput, visualRules),
      fishGems: preview.fg,
      catGems: preview.cg,
      bonusGems: preview.couple.gems,
      coinDelta: preview.coin.delta,
    });
    setOpen(false);
    setFishW("");
    setCatW("");
    setFishD("0");
    setFishM("0");
    setCatD("0");
    setCatM("0");
    setToast("今天已经存好啦，明天继续并肩");
  }, [
    applyTodayRecord,
    catInput,
    fishInput,
    hasAnyEffort,
    preview,
    settlementDay,
    visualRules,
  ]);

  const onSaveHistory = useCallback(() => {
    if (!hasAnyHistoryEffort || historyDay == null) return;
    const result = upsertHistoricalRecord({
      recordDate: historyDate,
      fish:
        historyMode === "both" || historyPerson === "fish"
          ? {
              weightKg: null,
              deficit: historyFishInput.deficit,
              minutes: historyFishInput.minutes,
            }
          : null,
      cat:
        historyMode === "both" || historyPerson === "cat"
          ? {
              weightKg: null,
              deficit: historyCatInput.deficit,
              minutes: historyCatInput.minutes,
            }
          : null,
    });
    if (!result.ok) {
      setToast(
        result.reason === "future-date"
          ? "不能补记未来日期"
          : "请选择有效日期",
      );
      return;
    }
    setOpen(false);
    setHistoryFishD("0");
    setHistoryFishM("0");
    setHistoryCatD("0");
    setHistoryCatM("0");
    setToast(result.updatedExisting ? "这一天已经更新完成" : "历史记录已保存");
  }, [
    hasAnyHistoryEffort,
    historyCatInput,
    historyDate,
    historyDay,
    historyFishInput,
    historyMode,
    historyPerson,
    upsertHistoricalRecord,
  ]);

  return (
    <>
      <div className="space-y-2 pt-1">
        {buttonVariant === "full" || buttonVariant === "today" ? (
          <button
            type="button"
            onClick={() => {
              setMode("today");
              setOpen(true);
            }}
            className="ui-button-primary relative w-full overflow-hidden px-6 py-3.5 text-base font-bold text-white ring-2 ring-rose-200/30 will-change-transform sm:py-4"
          >
            <span className="relative flex items-center justify-center gap-2 drop-shadow-sm">
              记录今天
            </span>
          </button>
        ) : null}
        {buttonVariant === "full" || buttonVariant === "history" ? (
          <button
            type="button"
            onClick={() => {
              setMode("history");
              const nextDate = getDefaultHistoryDate();
              const nextRecord =
                dailyRecords.find((record) => recordIsoDate(record) === nextDate) ??
                null;
              setHistoryDate(nextDate);
              hydrateHistoryInputs(nextRecord);
              setOpen(true);
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border border-white/80 bg-white/70 px-3 py-3 text-sm font-bold text-stone-700 shadow-sm shadow-rose-100/25 transition duration-200 hover:-translate-y-0.5 hover:bg-white/85 active:scale-[0.98]"
          >
            <span aria-hidden>📝</span>
            <span>补录记录</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            aria-label="关闭"
            className={`absolute inset-0 bg-stone-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${
              entered ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 shadow-2xl shadow-rose-200/40 transition-all duration-300 ease-out ${
              entered
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
            }`}
          >
            <div className="shrink-0 border-b border-rose-100/60 px-4 pb-3 pt-4 text-center">
              <p className="text-[10px] font-bold tracking-[0.2em] text-rose-400/90">
                {mode === "today" ? "今日收工啦" : "补记一颗星"}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold text-stone-800">
                {mode === "today" ? "双人结算面板" : "历史记录补记"}
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                {mode === "today"
                  ? "一起把今天轻轻收进小背包"
                  : "支持单人补记，也支持双人同时更新"}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
              {mode === "today" ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <PartnerColumn
                      emoji="🐟"
                      title="鱼鱼这边"
                      weight={fishW}
                      setWeight={setFishW}
                      deficit={fishD}
                      setDeficit={setFishD}
                      minutes={fishM}
                      setMinutes={setFishM}
                    />
                    <PartnerColumn
                      emoji="🐱"
                      title="猫猫这边"
                      weight={catW}
                      setWeight={setCatW}
                      deficit={catD}
                      setDeficit={setCatD}
                      minutes={catM}
                      setMinutes={setCatM}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-amber-100/80 bg-white/55 p-3.5 shadow-inner shadow-amber-50/50 backdrop-blur-sm">
                    <p className="text-center text-[11px] font-bold text-amber-700/90">
                      结算预览
                    </p>
                    <ul className="mt-3 space-y-2 text-xs font-semibold text-stone-700">
                      <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5">
                        <span>🐟 今日宝石</span>
                        <span className="tabular-nums text-rose-600">
                          +{preview.fg}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5">
                        <span>🐱 今日宝石</span>
                        <span className="tabular-nums text-rose-600">
                          +{preview.cg}
                        </span>
                      </li>
                      <li className="flex flex-col gap-1 rounded-xl bg-gradient-to-r from-pink-50/80 to-amber-50/70 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>情侣 bonus</span>
                          <span className="tabular-nums text-pink-600">
                            {preview.couple.gems > 0
                              ? `+${preview.couple.gems}`
                              : "—"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-stone-400">
                          {preview.couple.reasons[0] ??
                            "双方都运动 30 分钟以上时触发"}
                        </p>
                      </li>
                      <li className="flex flex-col gap-0.5 rounded-xl bg-amber-50/55 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>金币变化</span>
                          <span
                            className={
                              preview.coin.delta > 0
                                ? "tabular-nums text-amber-700"
                                : "text-[11px] font-medium text-stone-400"
                            }
                          >
                            {preview.coin.delta > 0
                              ? `+${preview.coin.delta}`
                              : "未触发"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed text-stone-500">
                          {preview.coin.hint}
                        </p>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-2xl border border-white/80 bg-white/50 py-3 text-sm font-bold text-stone-500 transition hover:bg-white/80"
                    >
                      下次再记
                    </button>
                    <button
                      type="button"
                      disabled={!hasAnyEffort}
                      onClick={onConfirm}
                      className="flex-[1.35] rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-400 to-pink-400 py-3 text-sm font-bold text-white shadow-md shadow-rose-200/50 transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      确认记录今天
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-[11px] font-semibold text-stone-600">
                      日期
                    </span>
                    <input
                      type="date"
                      value={historyDate}
                      max={maxHistoryDate}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        const nextRecord =
                          dailyRecords.find(
                            (record) => recordIsoDate(record) === nextDate,
                          ) ?? null;
                        setHistoryDate(nextDate);
                        hydrateHistoryInputs(nextRecord);
                      }}
                      className="mt-1 w-full rounded-2xl border border-white/80 bg-white/70 px-3 py-2.5 text-sm font-semibold text-stone-800 outline-none"
                    />
                  </label>

                  <div>
                    <p className="text-[11px] font-semibold text-stone-600">
                      编辑方式
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryMode("single")}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                          historyMode === "single"
                            ? "border-rose-200/90 bg-rose-50/85 text-rose-700"
                            : "border-white/80 bg-white/60 text-stone-500"
                        }`}
                      >
                        单人
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryMode("both")}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                          historyMode === "both"
                            ? "border-rose-200/90 bg-rose-50/85 text-rose-700"
                            : "border-white/80 bg-white/60 text-stone-500"
                        }`}
                      >
                        双人
                      </button>
                    </div>
                  </div>

                  {historyMode === "single" ? (
                    <>
                      <div>
                        <p className="text-[11px] font-semibold text-stone-600">
                          用户
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryPerson("fish")}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                              historyPerson === "fish"
                                ? "border-rose-200/90 bg-rose-50/85 text-rose-700"
                                : "border-white/80 bg-white/60 text-stone-500"
                            }`}
                          >
                            🐟 鱼鱼
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryPerson("cat")}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${
                              historyPerson === "cat"
                                ? "border-rose-200/90 bg-rose-50/85 text-rose-700"
                                : "border-white/80 bg-white/60 text-stone-500"
                            }`}
                          >
                            🐱 猫猫
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <SoftField
                          label="热量缺口"
                          value={
                            historyPerson === "fish" ? historyFishD : historyCatD
                          }
                          onChange={
                            historyPerson === "fish"
                              ? setHistoryFishD
                              : setHistoryCatD
                          }
                          inputMode="numeric"
                          unit="kcal"
                        />
                        <SoftField
                          label="运动时长"
                          value={
                            historyPerson === "fish" ? historyFishM : historyCatM
                          }
                          onChange={
                            historyPerson === "fish"
                              ? setHistoryFishM
                              : setHistoryCatM
                          }
                          inputMode="numeric"
                          unit="分钟"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2.5">
                      <HistoryPartnerCard
                        emoji="🐟"
                        title="鱼鱼"
                        deficit={historyFishD}
                        setDeficit={setHistoryFishD}
                        minutes={historyFishM}
                        setMinutes={setHistoryFishM}
                      />
                      <HistoryPartnerCard
                        emoji="🐱"
                        title="猫猫"
                        deficit={historyCatD}
                        setDeficit={setHistoryCatD}
                        minutes={historyCatM}
                        setMinutes={setHistoryCatM}
                      />
                    </div>
                  )}

                  <div className="rounded-2xl border border-amber-100/80 bg-white/55 p-3.5 shadow-inner shadow-amber-50/50 backdrop-blur-sm">
                    <p className="text-center text-[11px] font-bold text-amber-700/90">
                      历史结算预览
                    </p>
                    <ul className="mt-3 space-y-2 text-xs font-semibold text-stone-700">
                      <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5">
                        <span>🐟 鱼鱼宝石</span>
                        <span className="tabular-nums text-rose-600">
                          +{historyPreview.fg}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5">
                        <span>🐱 猫猫宝石</span>
                        <span className="tabular-nums text-rose-600">
                          +{historyPreview.cg}
                        </span>
                      </li>
                      <li className="flex flex-col gap-1 rounded-xl bg-gradient-to-r from-pink-50/80 to-amber-50/70 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>情侣 bonus</span>
                          <span className="tabular-nums text-pink-600">
                            {historyPreview.couple.gems > 0
                              ? `+${historyPreview.couple.gems}`
                              : "—"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-stone-400">
                          {historyPreview.couple.reasons[0] ??
                            "当天双方都达到 30 分钟运动时触发"}
                        </p>
                      </li>
                      <li className="flex flex-col gap-0.5 rounded-xl bg-amber-50/55 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>金币变化</span>
                          <span
                            className={
                              historyPreview.coin.delta > 0
                                ? "tabular-nums text-amber-700"
                                : "text-[11px] font-medium text-stone-400"
                            }
                          >
                            {historyPreview.coin.delta > 0
                              ? `+${historyPreview.coin.delta}`
                              : "未触发"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed text-stone-500">
                          {historyPreview.coin.hint}
                        </p>
                      </li>
                    </ul>
                    {existingHistoryRecord ? (
                      <p className="mt-2 text-center text-[10px] font-medium text-stone-500">
                        这一天已有记录，保存会覆盖你当前编辑到的那一侧或整天数据。
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="flex-1 rounded-2xl border border-white/80 bg-white/50 py-3 text-sm font-bold text-stone-500 transition hover:bg-white/80"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={
                        !hasAnyHistoryEffort ||
                        historyDay == null ||
                        historyDate > maxHistoryDate
                      }
                      onClick={onSaveHistory}
                      className="flex-[1.35] rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-400 to-pink-400 py-3 text-sm font-bold text-white shadow-md shadow-rose-200/50 transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      保存历史记录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,20rem)] -translate-x-1/2 rounded-2xl border border-white/80 bg-white/92 px-4 py-3 text-center text-xs font-semibold text-stone-700 shadow-lg shadow-rose-200/40 backdrop-blur-md"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
