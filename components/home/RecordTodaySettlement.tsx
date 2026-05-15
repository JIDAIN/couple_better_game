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
      <span className="ui-field-label">{label}</span>
      {hint ? (
        <span className="ui-field-hint">{hint}</span>
      ) : null}
      <div className="ui-input-shell mt-1 flex items-center gap-1.5 px-3 py-2">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums ui-text-main outline-none placeholder:text-[var(--text-soft)]"
          placeholder="0"
        />
        {unit ? (
          <span className="shrink-0 text-[11px] font-medium ui-text-soft">
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
    <div className="ui-soft-panel ui-card-item flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-2 pb-1.5">
        <span className="text-xl" aria-hidden>
          {emoji}
        </span>
        <div>
          <p className="text-xs font-bold ui-text-main">{title}</p>
          <p className="text-[10px] ui-text-soft">轻轻填就好</p>
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
    <div className="ui-soft-panel ui-card-item">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden>{emoji}</span>
        <p className="text-xs font-bold ui-text-main">{title}</p>
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
            className="ui-button-primary relative w-full overflow-hidden px-6 py-3.5 text-base font-semibold text-white will-change-transform sm:py-4"
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
            className="ui-nav-button inline-flex w-full whitespace-nowrap text-sm"
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
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              entered ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ui-sheet relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden transition-all duration-300 ease-out ${
              entered
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
            }`}
          >
            <div className="ui-modal-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.2em] ui-text-primary">
                {mode === "today" ? "今日收工啦" : "补记一颗星"}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold ui-text-main">
                {mode === "today" ? "今天的小记录" : "历史记录补记"}
              </h2>
              <p className="mt-1 text-xs ui-text-muted">
                {mode === "today"
                  ? "一起把今天轻轻收进小背包"
                  : "支持单人补记，也支持双人同时更新"}
              </p>
            </div>

            <div className="ui-modal-body">
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

                  <div className="ui-soft-panel ui-card-item mt-4">
                    <p className="text-center text-[11px] font-bold ui-text-reward">
                      今日小奖励
                    </p>
                    <ul className="mt-3 space-y-2 text-xs font-semibold ui-text-main">
                      <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                        <span>🐟 今日宝石</span>
                        <span className="tabular-nums ui-text-primary">
                          💎 +{preview.fg}
                        </span>
                      </li>
                      <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                        <span>🐱 今日宝石</span>
                        <span className="tabular-nums ui-text-primary">
                          💎 +{preview.cg}
                        </span>
                      </li>
                      <li className="ui-tinted-reward flex flex-col gap-1 rounded-2xl px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>情侣 bonus</span>
                          <span className="tabular-nums ui-text-primary">
                            {preview.couple.gems > 0
                              ? `+${preview.couple.gems}`
                              : "—"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium ui-text-soft">
                          {preview.couple.reasons[0] ??
                            "双方都运动 30 分钟以上时触发"}
                        </p>
                      </li>
                      <li className="ui-tinted-reward flex flex-col gap-0.5 rounded-2xl px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>金币变化</span>
                          <span
                            className={
                              preview.coin.delta > 0
                                ? "inline-flex items-baseline gap-0.5 tabular-nums ui-text-reward"
                                : "inline-flex items-baseline gap-0.5 text-[11px] font-medium ui-text-soft"
                            }
                          >
                            {preview.coin.delta > 0
                              ? `🪙 +${preview.coin.delta}`
                              : "未触发"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed ui-text-muted">
                          {preview.coin.hint}
                        </p>
                      </li>
                    </ul>
                  </div>

                  <div className="ui-modal-footer">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
                    >
                      下次再记
                    </button>
                    <button
                      type="button"
                      disabled={!hasAnyEffort}
                      onClick={onConfirm}
                      className="ui-button-primary flex-[1.35] py-3 text-sm font-semibold text-white transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      存好今天
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <label className="block">
                    <span className="ui-field-label">
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
                      className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                    />
                  </label>

                  <div>
                    <p className="ui-field-label">
                      编辑方式
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setHistoryMode("single")}
                        className={`ui-tab flex text-sm transition ${
                          historyMode === "single"
                            ? "ui-tab-active"
                            : "ui-tab-idle"
                        }`}
                      >
                        单人
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryMode("both")}
                        className={`ui-tab flex text-sm transition ${
                          historyMode === "both"
                            ? "ui-tab-active"
                            : "ui-tab-idle"
                        }`}
                      >
                        双人
                      </button>
                    </div>
                  </div>

                  {historyMode === "single" ? (
                    <>
                      <div>
                        <p className="ui-field-label">
                          用户
                        </p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryPerson("fish")}
                            className={`ui-tab flex text-sm transition ${
                              historyPerson === "fish"
                                ? "ui-tab-active"
                                : "ui-tab-idle"
                            }`}
                          >
                            🐟 鱼鱼
                          </button>
                          <button
                            type="button"
                            onClick={() => setHistoryPerson("cat")}
                            className={`ui-tab flex text-sm transition ${
                              historyPerson === "cat"
                                ? "ui-tab-active"
                                : "ui-tab-idle"
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

                  <div className="ui-soft-panel ui-card-item">
                    <p className="text-center text-[11px] font-bold ui-text-reward">
                      补记后的小奖励
                    </p>
                    <ul className="mt-3 space-y-2 text-xs font-semibold ui-text-main">
                      <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                        <span>🐟 鱼鱼宝石</span>
                        <span className="tabular-nums ui-text-primary">
                          💎 +{historyPreview.fg}
                        </span>
                      </li>
                      <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                        <span>🐱 猫猫宝石</span>
                        <span className="tabular-nums ui-text-primary">
                          💎 +{historyPreview.cg}
                        </span>
                      </li>
                      <li className="ui-tinted-reward flex flex-col gap-1 rounded-2xl px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>情侣 bonus</span>
                          <span className="tabular-nums ui-text-primary">
                            {historyPreview.couple.gems > 0
                              ? `+${historyPreview.couple.gems}`
                              : "—"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium ui-text-soft">
                          {historyPreview.couple.reasons[0] ??
                            "当天双方都达到 30 分钟运动时触发"}
                        </p>
                      </li>
                      <li className="ui-tinted-reward flex flex-col gap-0.5 rounded-2xl px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span>金币变化</span>
                          <span
                            className={
                              historyPreview.coin.delta > 0
                                ? "inline-flex items-baseline gap-0.5 tabular-nums ui-text-reward"
                                : "inline-flex items-baseline gap-0.5 text-[11px] font-medium ui-text-soft"
                            }
                          >
                            {historyPreview.coin.delta > 0
                              ? `🪙 +${historyPreview.coin.delta}`
                              : "未触发"}
                          </span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed ui-text-muted">
                          {historyPreview.coin.hint}
                        </p>
                      </li>
                    </ul>
                    {existingHistoryRecord ? (
                      <p className="mt-2 text-center text-[10px] font-medium ui-text-muted">
                        这一天已有记录，保存会覆盖你当前编辑到的那一侧或整天数据。
                      </p>
                    ) : null}
                  </div>

                  <div className="ui-modal-footer">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
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
                      className="ui-button-primary flex-[1.35] py-3 text-sm font-semibold text-white transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
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
          className="ui-dialog pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] w-[min(92vw,20rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold ui-text-main"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
