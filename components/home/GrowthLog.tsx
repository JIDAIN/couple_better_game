"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";
import {
  computeCoinPreview,
  computeCoupleBonus,
  gemBreakdownForPerson,
  isInCoinWeek,
  parseInteger,
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

function formatBreakdownLines(lines: string[]) {
  const labels: Record<string, string> = {
    缺口宝石: "缺口",
    运动宝石: "运动",
    恢复日奖励: "恢复",
  };
  const formatted = lines
    .map((line) => {
      const match = /^(缺口宝石|运动宝石|恢复日奖励) \+(\d+)$/.exec(line);
      if (!match) return line;
      const value = Number(match[2]);
      if (value <= 0) return null;
      return `${labels[match[1]]} +${value}`;
    })
    .filter((line): line is string => Boolean(line));
  return formatted;
}

function personGemNoteFromLines(lines: string[]): string | null {
  const parts = formatBreakdownLines(lines);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatCoinHint(hint: string) {
  if (hint === "本日暂未触发金币规则") return "还没点亮";
  return hint
    .split(" · ")
    .map((part) =>
      part
        .replace(/本周新增宝石达到 30：\+1/g, "本周达标")
        .replace(/本周新增宝石达到 50：再 \+1/g, "本周进阶")
        .replace(/双人连续 \d+ 天达到一般打卡：\+1/g, "连续坚持")
        .replace(/本周一起运动达到 2 次：\+1/g, "一起运动"),
    )
    .join(" · ");
}

function signedAmount(value: number) {
  return value > 0 ? `+${value}` : "0";
}

/** 金币展示不依赖 emoji，避免部分字体不支持金币符号时语义丢失。 */
function coinAmountLabel(value: number) {
  return `金币 ${signedAmount(value)}`;
}

function sideInputFromRecord(record: DailyRecord, side: "fish" | "cat") {
  return {
    weightKg: record[side].weightKg,
    deficit: record[side].deficit,
    minutes: record[side].minutes,
  };
}

function CoinHintText({ hint }: { hint: string }) {
  const line = formatCoinHint(hint);
  if (!line.trim()) return null;
  return <p className="growth-detail-extra-hint">{line}</p>;
}

function BonusHintText({ active }: { active: boolean }) {
  return (
    <p className="growth-detail-extra-hint">
      {active ? "一起点亮" : "满 30 分钟时点亮"}
    </p>
  );
}

function GemBreakdownText({ lines }: { lines: string[] }) {
  const note = personGemNoteFromLines(lines);
  if (!note) return null;
  return <p className="growth-detail-extra-hint">{note}</p>;
}

function CompactField({
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
    <label className="compact-field">
      <span className="compact-field-label">{label}</span>
      <div className="compact-field-input">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          placeholder="0"
        />
        {unit ? <span>{unit}</span> : null}
      </div>
    </label>
  );
}

function PersonDetailCard({
  emoji,
  title,
  deficit,
  minutes,
  gems,
  lines,
}: {
  emoji: string;
  title: string;
  deficit: number;
  minutes: number;
  gems: number;
  lines: string[];
}) {
  const note = personGemNoteFromLines(lines);
  return (
    <div className="growth-person-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="ui-text-main">
          <span aria-hidden>{emoji}</span> {title}
        </h3>
        <span className="ui-price-pill ui-chip-primary">宝石 +{gems}</span>
      </div>
      <div className="growth-person-metrics">
        <span>{deficit} kcal</span>
        <span>{minutes} min</span>
      </div>
      {note ? <p className="growth-person-note">{note}</p> : null}
    </div>
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
    <div className="growth-partner-form ui-soft-panel ui-card-item flex min-w-0 flex-col">
      <p className="text-[11px] font-bold ui-text-main">
        <span aria-hidden>{emoji}</span> {title}
      </p>
      <CompactField
        label="今日体重"
        value={weight}
        onChange={setWeight}
        inputMode="decimal"
        unit="kg"
      />
      <CompactField
        label="运动时长"
        value={minutes}
        onChange={setMinutes}
        inputMode="numeric"
        unit="min"
      />
      <CompactField
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
      className="growth-log-row text-left transition hover:brightness-[1.02] active:scale-[0.99]"
    >
      <span className="growth-log-date">{formatMonthDay(entry.recordDate)}</span>
      <span className="growth-log-summary">
        <span className="ui-price-pill ui-chip-primary">💎 +{totalGems(entry)}</span>
        <span className="ui-price-pill ui-chip-reward">
          {coinAmountLabel(entry.coins)}
        </span>
        <span className="growth-log-detail-link">详情 ›</span>
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
      deficit: parseInteger(fishD),
      minutes: parseNonNegativeInt(fishM),
    }),
    [fishD, fishM, fishW],
  );
  const catInput: SideLogInput = useMemo(
    () => ({
      weightKg: parseOptionalWeight(catW),
      deficit: parseInteger(catD),
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
    let cancelled = false;
    const outerId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setSheetEnter(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerId);
    };
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
            className={`ui-sheet growth-log-sheet relative flex flex-col overflow-hidden transition-all duration-300 ease-out will-change-transform ${
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
                <div className="record-list growth-log-record-list">
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
            className="ui-sheet growth-log-detail-sheet relative flex min-h-0 flex-col overflow-hidden"
          >
            <div className="ui-modal-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.18em] ui-text-primary">
                {detailMode === "detail" ? "记录详情" : "修改这一天"}
              </p>
              <h2 id={detailTitleId} className="mt-1 text-lg font-bold ui-text-main">
                {formatFullDate(selectedRecord.recordDate)}
              </h2>
              <p className="mt-1 text-xs font-medium ui-text-muted">
                {detailMode === "detail"
                  ? "今天也攒下了一点闪光"
                  : "轻轻改就好"}
              </p>
            </div>

            <div className="ui-modal-body">
              {detailMode === "detail" && detailPreview ? (
                <div className="space-y-2.5">
                  <div className="growth-detail-summary">
                    <span className="growth-summary-pill ui-chip-primary ui-text-primary">
                      <span aria-hidden>💎</span>
                      <span>本日宝石 +{totalGems(selectedRecord)}</span>
                    </span>
                    <span className="growth-summary-pill ui-chip-reward ui-text-reward">
                      <span aria-hidden>🪙</span>
                      <span>本日{coinAmountLabel(selectedRecord.coins)}</span>
                    </span>
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5">
                    <PersonDetailCard
                      emoji="🐟"
                      title="鱼鱼"
                      deficit={selectedRecord.fish.deficit}
                      minutes={selectedRecord.fish.minutes}
                      gems={selectedRecord.fish.gems}
                      lines={detailPreview.fishBreakdown.lines}
                    />
                    <PersonDetailCard
                      emoji="🐱"
                      title="猫猫"
                      deficit={selectedRecord.cat.deficit}
                      minutes={selectedRecord.cat.minutes}
                      gems={selectedRecord.cat.gems}
                      lines={detailPreview.catBreakdown.lines}
                    />
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <div className="growth-detail-extra-card">
                      <div className="growth-detail-extra-row">
                        <span className="growth-detail-extra-title">🔥 一起加成</span>
                        {selectedRecord.bonus > 0 ? (
                          <span className="growth-detail-extra-value-pill ui-chip-primary ui-text-primary">
                            宝石 +{selectedRecord.bonus}
                          </span>
                        ) : (
                          <span className="growth-detail-extra-value growth-detail-extra-value--muted">
                            未点亮
                          </span>
                        )}
                      </div>
                      <BonusHintText active={selectedRecord.bonus > 0} />
                    </div>
                    <div className="growth-detail-extra-card">
                      <div className="growth-detail-extra-row">
                        <span className="growth-detail-extra-title">🪙 金币</span>
                        <span className="growth-detail-extra-value-pill ui-chip-reward ui-text-reward">
                          {coinAmountLabel(selectedRecord.coins)}
                        </span>
                      </div>
                      <CoinHintText hint={detailPreview.coin.hint} />
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
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
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
                      修改后的小奖励
                    </p>
                    <ul className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-xs font-semibold ui-text-main">
                      <li className="growth-detail-extra-card">
                        <span className="flex items-center justify-between gap-2">
                          <span aria-hidden>🐟</span>
                          <span className="tabular-nums ui-text-primary">
                            宝石 +{editPreview.fishBreakdown.total}
                          </span>
                        </span>
                        <GemBreakdownText lines={editPreview.fishBreakdown.lines} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <span className="flex items-center justify-between gap-2">
                          <span aria-hidden>🐱</span>
                          <span className="tabular-nums ui-text-primary">
                            宝石 +{editPreview.catBreakdown.total}
                          </span>
                        </span>
                        <GemBreakdownText lines={editPreview.catBreakdown.lines} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">🔥 一起加成</span>
                          {editPreview.couple.gems > 0 ? (
                            <span className="growth-detail-extra-value-pill ui-chip-primary ui-text-primary">
                              宝石 +{editPreview.couple.gems}
                            </span>
                          ) : (
                            <span className="growth-detail-extra-value growth-detail-extra-value--muted">
                              未点亮
                            </span>
                          )}
                        </div>
                        <BonusHintText active={editPreview.couple.gems > 0} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">🪙 金币</span>
                          <span className="growth-detail-extra-value-pill ui-chip-reward ui-text-reward">
                            {coinAmountLabel(editPreview.coin.delta)}
                          </span>
                        </div>
                        <CoinHintText hint={editPreview.coin.hint} />
                      </li>
                    </ul>
                  </div>

                  <div className="growth-log-edit-footer">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="growth-log-delete-btn"
                    >
                      删除
                    </button>
                    <div className="growth-log-edit-footer-actions">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedRecord) hydrateEditFields(selectedRecord);
                          setDetailMode("detail");
                        }}
                        className="ui-button-secondary min-w-0 flex-1 py-2.5 text-sm font-semibold sm:flex-none sm:px-5"
                      >
                        取消编辑
                      </button>
                      <button
                        type="button"
                        onClick={onSaveEdit}
                        className="ui-button-primary min-w-0 flex-[1.2] py-2.5 text-sm font-semibold text-white transition active:scale-[0.99] sm:flex-none sm:px-6"
                      >
                        保存修改
                      </button>
                    </div>
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
            <p className="mt-2 text-xs leading-relaxed ui-text-muted">
              删掉就找不回这条啦。
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
