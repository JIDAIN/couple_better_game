"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";
import {
  computeCoinPreview,
  computeCoupleBonus,
  gemBreakdownForPerson,
  isInCoinWeek,
  parseNonNegativeInt,
  parseOptionalWeight,
  type SideLogInput,
} from "./settlement-rules";

type GrowthLogEntry = DailyRecord;
type DetailMode = "detail" | "edit";
const FALLBACK_MONTH_KEY = "2026-05";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function monthKeyFromDate(value: string) {
  return value.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return `${year}年${month}月`;
}

function formatMonthDay(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

function formatFullDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month - 1 + delta, 1);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
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
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function totalGems(entry: GrowthLogEntry) {
  return entry.fish.gems + entry.cat.gems + entry.bonus;
}

function formatCoinDelta(value: number) {
  return value > 0 ? `+${value}` : "0";
}

function sideInputFromRecord(record: DailyRecord, side: "fish" | "cat") {
  return {
    weightKg: record[side].weightKg,
    deficit: record[side].deficit,
    minutes: record[side].minutes,
  };
}

function DetailLines({ lines }: { lines: string[] }) {
  return (
    <ul className="mt-2 space-y-1 text-[11px] font-medium leading-4 ui-text-muted">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  unit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal" | "numeric";
  unit?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="ui-field-label">{label}</span>
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

function EditSide({
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
      <p className="text-xs font-bold ui-text-main">
        <span aria-hidden>{emoji}</span> {title}
      </p>
      <Field
        label="今日体重"
        value={weight}
        onChange={setWeight}
        inputMode="decimal"
        unit="kg"
      />
      <Field
        label="运动时长"
        value={minutes}
        onChange={setMinutes}
        inputMode="numeric"
        unit="分钟"
      />
      <Field
        label="热量缺口"
        value={deficit}
        onChange={setDeficit}
        inputMode="numeric"
        unit="kcal"
      />
    </div>
  );
}

function LogCard({
  entry,
  onOpen,
}: {
  entry: GrowthLogEntry;
  onOpen: (entry: GrowthLogEntry) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      className="record-item growth-log-item w-full text-left transition hover:bg-white/80 active:scale-[0.995]"
    >
      <span className="growth-log-line">
        <span className="growth-log-date">{formatMonthDay(entry.recordDate)}</span>
        <span className="ui-price-pill ui-chip-primary growth-log-pill">
          💎 +{totalGems(entry)}
        </span>
        <span className="ui-price-pill ui-chip-reward growth-log-pill">
          🪙 {formatCoinDelta(entry.coins)}
        </span>
        <span className="ui-action-pill ui-chip-plain growth-log-action">
          详情 ›
        </span>
      </span>
    </button>
  );
}

type PreviewInput = {
  record: DailyRecord;
  fish: SideLogInput;
  cat: SideLogInput;
};

function useSettlementPreview({
  coinRules,
  dailyRecords,
  input,
  visualRules,
}: {
  coinRules: ReturnType<typeof useHomeResources>["coinRules"];
  dailyRecords: DailyRecord[];
  input: PreviewInput | null;
  visualRules: ReturnType<typeof useHomeResources>["visualRules"];
}) {
  return useMemo(() => {
    if (!input) return null;
    const previousDate = previousDateInputValue(input.record.recordDate);
    const previousRecord = previousDate
      ? dailyRecords.find((record) => record.recordDate === previousDate) ?? null
      : null;
    const fishBreakdown = gemBreakdownForPerson(
      "fish",
      input.fish,
      previousRecord,
    );
    const catBreakdown = gemBreakdownForPerson(
      "cat",
      input.cat,
      previousRecord,
    );
    const couple = computeCoupleBonus(input.fish, input.cat);
    const recordsWithoutCurrent = dailyRecords.filter(
      (record) => record.id !== input.record.id,
    );
    const weekGemTotalForDate = recordsWithoutCurrent.reduce(
      (total, record) =>
        isInCoinWeek(
          record.recordDate,
          input.record.recordDate,
          coinRules.weekStartDay,
        ) && record.recordDate < input.record.recordDate
          ? total + totalGems(record)
          : total,
      0,
    );
    const coin = computeCoinPreview({
      fish: input.fish,
      cat: input.cat,
      todayDay: input.record.day,
      todayDate: input.record.recordDate,
      todayGemTotal: fishBreakdown.total + catBreakdown.total + couple.gems,
      currentWeekGemTotal: weekGemTotalForDate,
      dailyRecords: recordsWithoutCurrent,
      coinRules,
      visualRules,
    });

    return {
      fishBreakdown,
      catBreakdown,
      couple,
      coin,
      totalGems: fishBreakdown.total + catBreakdown.total + couple.gems,
    };
  }, [coinRules, dailyRecords, input, visualRules]);
}

export function GrowthLog() {
  const {
    coinRules,
    dailyRecords,
    deleteDailyRecord,
    updateDailyRecord,
    visualRules,
  } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("detail");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const latestRecord = [...dailyRecords].sort((a, b) =>
      b.recordDate.localeCompare(a.recordDate),
    )[0];
    return latestRecord
      ? monthKeyFromDate(latestRecord.recordDate)
      : FALLBACK_MONTH_KEY;
  });
  const titleId = useId();
  const detailTitleId = useId();
  const confirmTitleId = useId();

  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

  const selectedRecord = useMemo(
    () =>
      selectedRecordId
        ? dailyRecords.find((record) => record.id === selectedRecordId) ?? null
        : null,
    [dailyRecords, selectedRecordId],
  );

  const sortedRecords = useMemo(
    () =>
      [...dailyRecords]
        .filter((record) => monthKeyFromDate(record.recordDate) === viewMonth)
        .sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
    [dailyRecords, viewMonth],
  );

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

  const detailInput = useMemo(
    () =>
      selectedRecord
        ? {
            record: selectedRecord,
            fish: sideInputFromRecord(selectedRecord, "fish"),
            cat: sideInputFromRecord(selectedRecord, "cat"),
          }
        : null,
    [selectedRecord],
  );

  const editInput = useMemo(
    () =>
      selectedRecord
        ? {
            record: selectedRecord,
            fish: fishInput,
            cat: catInput,
          }
        : null,
    [catInput, fishInput, selectedRecord],
  );

  const detailPreview = useSettlementPreview({
    coinRules,
    dailyRecords,
    input: detailInput,
    visualRules,
  });
  const editPreview = useSettlementPreview({
    coinRules,
    dailyRecords,
    input: editInput,
    visualRules,
  });

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (dailyRecords.length === 0 || viewMonth !== FALLBACK_MONTH_KEY) return;
    const latestRecord = [...dailyRecords].sort((a, b) =>
      b.recordDate.localeCompare(a.recordDate),
    )[0];
    if (!latestRecord) return;
    const timeout = window.setTimeout(() => {
      setViewMonth(monthKeyFromDate(latestRecord.recordDate));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [dailyRecords, viewMonth]);

  useEffect(() => {
    if (!open && !selectedRecord) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, selectedRecord]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!open && !selectedRecord && !confirmDeleteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirmDeleteOpen) {
        setConfirmDeleteOpen(false);
        return;
      }
      if (selectedRecord) {
        setSelectedRecordId(null);
        setDetailMode("detail");
        return;
      }
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmDeleteOpen, open, selectedRecord]);

  const closeSheet = () => {
    setSheetEnter(false);
    setOpen(false);
  };

  const onPrevMonth = () => setViewMonth((current) => addMonths(current, -1));
  const onNextMonth = () => setViewMonth((current) => addMonths(current, 1));

  const hydrateEditFields = (entry: GrowthLogEntry) => {
    setFishW(entry.fish.weightKg == null ? "" : String(entry.fish.weightKg));
    setFishD(String(entry.fish.deficit));
    setFishM(String(entry.fish.minutes));
    setCatW(entry.cat.weightKg == null ? "" : String(entry.cat.weightKg));
    setCatD(String(entry.cat.deficit));
    setCatM(String(entry.cat.minutes));
  };

  const openDetail = (entry: GrowthLogEntry) => {
    setSelectedRecordId(entry.id);
    setDetailMode("detail");
    setConfirmDeleteOpen(false);
    hydrateEditFields(entry);
  };

  const enterEditMode = () => {
    if (selectedRecord) hydrateEditFields(selectedRecord);
    setDetailMode("edit");
  };

  const closeDetail = () => {
    setSelectedRecordId(null);
    setDetailMode("detail");
    setConfirmDeleteOpen(false);
  };

  const onSaveEdit = () => {
    if (!selectedRecord) return;
    const result = updateDailyRecord(
      selectedRecord.recordDate,
      fishInput,
      catInput,
    );
    if (result.ok) {
      setDetailMode("detail");
      setToast("这一天已经更新啦");
    }
  };

  const onConfirmDelete = () => {
    if (!selectedRecord) return;
    const deleted = deleteDailyRecord(selectedRecord.recordDate);
    if (deleted) {
      setConfirmDeleteOpen(false);
      closeDetail();
      setToast("这一天已经删除啦");
      return;
    }
    setConfirmDeleteOpen(false);
    setToast("删除失败，请再试一次");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ui-nav-button inline-flex w-full whitespace-nowrap text-sm"
      >
        <span aria-hidden>📒</span>
        <span>成长日志</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-4">
          <button
            type="button"
            aria-label="关闭成长日志"
            className={`ui-modal-backdrop absolute inset-0 transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`ui-sheet ui-record-sheet relative flex flex-col overflow-hidden transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-3 opacity-0 sm:scale-95"
            }`}
          >
            <div className="record-sheet-header">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold leading-6 tracking-tight ui-text-main">
                    📒 成长日志
                  </p>
                  <p className="text-xs font-medium leading-4 ui-text-soft">
                    一起攒下的每一天
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold"
                >
                  收起
                </button>
              </div>

              <div className="mt-2 flex justify-center">
                <div className="ui-input-shell inline-flex items-center gap-4 px-4 py-1.5">
                  <button
                    type="button"
                    onClick={onPrevMonth}
                    className="ui-button-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
                    aria-label="查看上个月"
                  >
                    ‹
                  </button>
                  <h2
                    id={titleId}
                    className="min-w-[7.2rem] text-center text-base font-semibold leading-6 tracking-tight ui-text-main"
                  >
                    {formatMonthLabel(viewMonth)}
                  </h2>
                  <button
                    type="button"
                    onClick={onNextMonth}
                    className="ui-button-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
                    aria-label="查看下个月"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="record-sheet-body">
              {sortedRecords.length > 0 ? (
                <div className="record-list">
                  {sortedRecords.map((entry) => (
                    <LogCard key={entry.id} entry={entry} onOpen={openDetail} />
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[12rem] items-center justify-center py-8 text-center text-sm font-semibold ui-text-muted">
                  这个月还没有成长记录
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedRecord ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            aria-label="关闭详情"
            className="ui-modal-backdrop absolute inset-0"
            onClick={closeDetail}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={detailTitleId}
            className="ui-sheet relative flex max-h-[min(92dvh,680px)] w-full max-w-lg flex-col overflow-hidden"
          >
            <div className="ui-modal-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.2em] ui-text-primary">
                {detailMode === "detail" ? "记录详情" : "编辑已有记录"}
              </p>
              <h2 id={detailTitleId} className="mt-1 text-lg font-bold ui-text-main">
                记录日期：{formatFullDate(selectedRecord.recordDate)}
              </h2>
              <p className="mt-1 text-xs ui-text-muted">
                日期不可修改；要补录其他日期，请从“记录今天”进入。
              </p>
            </div>

            <div className="ui-modal-body">
              {detailMode === "detail" && detailPreview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="ui-tinted-primary rounded-2xl px-3 py-2 text-center text-sm font-bold ui-text-primary">
                      💎 总宝石 +{totalGems(selectedRecord)}
                    </div>
                    <div className="ui-tinted-reward rounded-2xl px-3 py-2 text-center text-sm font-bold ui-text-reward">
                      🪙 金币变化 {formatCoinDelta(selectedRecord.coins)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <div className="ui-soft-panel ui-card-item">
                      <p className="text-xs font-bold ui-text-main">🐟 鱼鱼详情</p>
                      <p className="mt-2 text-xs ui-text-muted">
                        热量缺口：{selectedRecord.fish.deficit} kcal
                      </p>
                      <p className="mt-1 text-xs ui-text-muted">
                        运动时长：{selectedRecord.fish.minutes} 分钟
                      </p>
                      <p className="mt-2 text-xs font-bold ui-text-primary">
                        宝石：+{selectedRecord.fish.gems}
                      </p>
                      <DetailLines lines={detailPreview.fishBreakdown.lines} />
                    </div>
                    <div className="ui-soft-panel ui-card-item">
                      <p className="text-xs font-bold ui-text-main">🐱 猫猫详情</p>
                      <p className="mt-2 text-xs ui-text-muted">
                        热量缺口：{selectedRecord.cat.deficit} kcal
                      </p>
                      <p className="mt-1 text-xs ui-text-muted">
                        运动时长：{selectedRecord.cat.minutes} 分钟
                      </p>
                      <p className="mt-2 text-xs font-bold ui-text-primary">
                        宝石：+{selectedRecord.cat.gems}
                      </p>
                      <DetailLines lines={detailPreview.catBreakdown.lines} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="ui-tinted-reward rounded-2xl px-3 py-2">
                      <div className="flex items-center justify-between text-xs font-bold ui-text-main">
                        <span>情侣 bonus</span>
                        <span className="ui-text-primary">
                          {selectedRecord.bonus > 0
                            ? `💎 +${selectedRecord.bonus}`
                            : "-"}
                        </span>
                      </div>
                      <DetailLines
                        lines={
                          selectedRecord.bonus > 0
                            ? ["一起运动：双方各 +1，共 +2"]
                            : ["双方都运动满 30 分钟时触发"]
                        }
                      />
                    </div>
                    <div className="ui-tinted-reward rounded-2xl px-3 py-2">
                      <div className="flex items-center justify-between text-xs font-bold ui-text-main">
                        <span>金币变化</span>
                        <span className="ui-text-reward">
                          🪙 {formatCoinDelta(selectedRecord.coins)}
                        </span>
                      </div>
                      <DetailLines lines={[detailPreview.coin.hint]} />
                    </div>
                  </div>

                  <div className="ui-modal-footer">
                    <button
                      type="button"
                      onClick={closeDetail}
                      className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
                    >
                      关闭
                    </button>
                    <button
                      type="button"
                      onClick={enterEditMode}
                      className="ui-button-primary flex-[1.2] py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                    >
                      编辑
                    </button>
                  </div>
                </div>
              ) : null}

              {detailMode === "edit" && editPreview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                    <EditSide
                      emoji="🐟"
                      title="鱼鱼"
                      weight={fishW}
                      setWeight={setFishW}
                      deficit={fishD}
                      setDeficit={setFishD}
                      minutes={fishM}
                      setMinutes={setFishM}
                    />
                    <EditSide
                      emoji="🐱"
                      title="猫猫"
                      weight={catW}
                      setWeight={setCatW}
                      deficit={catD}
                      setDeficit={setCatD}
                      minutes={catM}
                      setMinutes={setCatM}
                    />
                  </div>

                  <div className="ui-soft-panel ui-card-item">
                    <p className="text-center text-[11px] font-bold ui-text-reward">
                      修改后的结算预览
                    </p>
                    <ul className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold ui-text-main">
                      <li className="ui-tinted-primary rounded-2xl px-2.5 py-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span>🐟 宝石</span>
                          <span className="tabular-nums ui-text-primary">
                            💎 +{editPreview.fishBreakdown.total}
                          </span>
                        </span>
                        <DetailLines lines={editPreview.fishBreakdown.lines} />
                      </li>
                      <li className="ui-tinted-primary rounded-2xl px-2.5 py-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span>🐱 宝石</span>
                          <span className="tabular-nums ui-text-primary">
                            💎 +{editPreview.catBreakdown.total}
                          </span>
                        </span>
                        <DetailLines lines={editPreview.catBreakdown.lines} />
                      </li>
                      <li className="ui-tinted-reward rounded-2xl px-2.5 py-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span>情侣 bonus</span>
                          <span className="tabular-nums ui-text-primary">
                            {editPreview.couple.gems > 0
                              ? `💎 +${editPreview.couple.gems}`
                              : "-"}
                          </span>
                        </span>
                        <DetailLines
                          lines={
                            editPreview.couple.gems > 0
                              ? ["一起运动：双方各 +1，共 +2"]
                              : ["双方都运动满 30 分钟时触发"]
                          }
                        />
                      </li>
                      <li className="ui-tinted-reward rounded-2xl px-2.5 py-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <span>金币变化</span>
                          <span
                            className={
                              editPreview.coin.delta > 0
                                ? "inline-flex items-baseline gap-0.5 tabular-nums ui-text-reward"
                                : "inline-flex items-baseline gap-0.5 text-[11px] font-medium ui-text-soft"
                            }
                          >
                            {editPreview.coin.delta > 0
                              ? `🪙 +${editPreview.coin.delta}`
                              : "未触发"}
                          </span>
                        </span>
                        <DetailLines lines={[editPreview.coin.hint]} />
                      </li>
                    </ul>
                  </div>

                  <div className="ui-modal-footer">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="rounded-[var(--radius-control)] border border-rose-100 bg-rose-50/40 px-3 py-3 text-sm font-semibold text-rose-500 transition active:scale-[0.99]"
                    >
                      删除
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedRecord) hydrateEditFields(selectedRecord);
                        setDetailMode("detail");
                      }}
                      className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
                    >
                      取消编辑
                    </button>
                    <button
                      type="button"
                      onClick={onSaveEdit}
                      className="ui-button-primary flex-[1.35] py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                    >
                      保存修改
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDeleteOpen && selectedRecord ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="取消删除"
            className="ui-modal-backdrop absolute inset-0"
            onClick={() => setConfirmDeleteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            className="ui-dialog relative w-full max-w-sm overflow-hidden px-5 py-5 text-center"
          >
            <h3 id={confirmTitleId} className="text-lg font-bold ui-text-main">
              要删除这一天吗？
            </h3>
            <p className="mt-2 text-sm leading-6 ui-text-muted">
              删除后，这一天的热力图、宝石和金币统计都会一起更新。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                className="flex-1 rounded-[var(--radius-control)] border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm font-semibold text-rose-500 transition active:scale-[0.99]"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="ui-dialog pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,20rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold ui-text-main"
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
