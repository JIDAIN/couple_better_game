"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";
import {
  computeCoinPreview,
  computeCoupleBonus,
  gemsForPerson,
  isInCoinWeek,
  parseNonNegativeInt,
  parseOptionalWeight,
  type SideLogInput,
} from "./settlement-rules";

type GrowthLogEntry = DailyRecord;

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
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
  onEdit,
}: {
  entry: GrowthLogEntry;
  onEdit: (entry: GrowthLogEntry) => void;
}) {
  const fishLabel = `🐟${entry.fish.deficit}kcal/${entry.fish.minutes}min`;
  const catLabel = `🐱${entry.cat.deficit}kcal/${entry.cat.minutes}min`;

  return (
    <button
      type="button"
      onClick={() => onEdit(entry)}
      className="record-item growth-log-item w-full text-left transition hover:bg-white/80 active:scale-[0.995]"
    >
      <span className="growth-log-line">
        <span className="growth-log-date">{formatMonthDay(entry.recordDate)}</span>

        <span className="growth-log-metric growth-log-fish">{fishLabel}</span>
        <span className="growth-log-metric growth-log-cat">{catLabel}</span>

        <span className="ui-price-pill ui-chip-primary growth-log-pill">
          💎 +{totalGems(entry)}
        </span>
        <span className="ui-price-pill ui-chip-reward growth-log-pill">
          🪙 {formatCoinDelta(entry.coins)}
        </span>
      </span>
    </button>
  );
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
  const [editing, setEditing] = useState<GrowthLogEntry | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const latestRecord = [...dailyRecords].sort((a, b) =>
      b.recordDate.localeCompare(a.recordDate),
    )[0];
    return latestRecord ? monthKeyFromDate(latestRecord.recordDate) : currentMonthKey();
  });
  const titleId = useId();
  const editTitleId = useId();

  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

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

  const preview = useMemo(() => {
    if (!editing) return null;
    const previousDate = previousDateInputValue(editing.recordDate);
    const previousRecord = previousDate
      ? dailyRecords.find((record) => record.recordDate === previousDate) ?? null
      : null;
    const fg = gemsForPerson("fish", fishInput, previousRecord);
    const cg = gemsForPerson("cat", catInput, previousRecord);
    const couple = computeCoupleBonus(fishInput, catInput);
    const recordsWithoutEditing = dailyRecords.filter(
      (record) => record.id !== editing.id,
    );
    const weekGemTotalForDate = recordsWithoutEditing.reduce(
      (total, record) =>
        isInCoinWeek(
          record.recordDate,
          editing.recordDate,
          coinRules.weekStartDay,
        )
          ? total + totalGems(record)
          : total,
      0,
    );
    const coin = computeCoinPreview({
      fish: fishInput,
      cat: catInput,
      todayDay: editing.day,
      todayDate: editing.recordDate,
      todayGemTotal: fg + cg + couple.gems,
      currentWeekGemTotal: weekGemTotalForDate,
      dailyRecords: recordsWithoutEditing,
      coinRules,
      visualRules,
    });
    return { fg, cg, couple, coin };
  }, [catInput, coinRules, dailyRecords, editing, fishInput, visualRules]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open && !editing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editing, open]);

  const closeSheet = () => {
    setSheetEnter(false);
    setOpen(false);
  };

  const onPrevMonth = () => setViewMonth((current) => addMonths(current, -1));
  const onNextMonth = () => setViewMonth((current) => addMonths(current, 1));

  const startEditing = (entry: GrowthLogEntry) => {
    setEditing(entry);
    setFishW(entry.fish.weightKg == null ? "" : String(entry.fish.weightKg));
    setFishD(String(entry.fish.deficit));
    setFishM(String(entry.fish.minutes));
    setCatW(entry.cat.weightKg == null ? "" : String(entry.cat.weightKg));
    setCatD(String(entry.cat.deficit));
    setCatM(String(entry.cat.minutes));
  };

  const onSaveEdit = () => {
    if (!editing) return;
    const result = updateDailyRecord(editing.recordDate, fishInput, catInput);
    if (result.ok) {
      setEditing(null);
    }
  };

  const onDeleteEdit = () => {
    if (!editing) return;
    if (!window.confirm("确认删除这一天的记录吗？")) return;
    const deleted = deleteDailyRecord(editing.recordDate);
    if (deleted) {
      setEditing(null);
    }
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
                    <LogCard key={entry.id} entry={entry} onEdit={startEditing} />
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

      {editing ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            aria-label="关闭编辑"
            className="ui-modal-backdrop absolute inset-0"
            onClick={() => setEditing(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={editTitleId}
            className="ui-sheet relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden"
          >
            <div className="ui-modal-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.2em] ui-text-primary">
                编辑已有记录
              </p>
              <h2 id={editTitleId} className="mt-1 text-lg font-bold ui-text-main">
                记录日期：{formatFullDate(editing.recordDate)}
              </h2>
              <p className="mt-1 text-xs ui-text-muted">
                成长日志只能编辑这一天的数据，日期不可修改。
              </p>
            </div>

            <div className="ui-modal-body">
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

              {preview ? (
                <div className="ui-soft-panel ui-card-item mt-4">
                  <p className="text-center text-[11px] font-bold ui-text-reward">
                    修改后的结算预览
                  </p>
                  <ul className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold ui-text-main">
                    <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                      <span>🐟 宝石</span>
                      <span className="tabular-nums ui-text-primary">
                        💎 +{preview.fg}
                      </span>
                    </li>
                    <li className="ui-tinted-primary flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                      <span>🐱 宝石</span>
                      <span className="tabular-nums ui-text-primary">
                        💎 +{preview.cg}
                      </span>
                    </li>
                    <li className="ui-tinted-reward flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
                      <span>情侣 bonus</span>
                      <span className="tabular-nums ui-text-primary">
                        {preview.couple.gems > 0
                          ? `💎 +${preview.couple.gems}`
                          : "-"}
                      </span>
                    </li>
                    <li className="ui-tinted-reward flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1.5">
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
                    </li>
                  </ul>
                </div>
              ) : null}

              <div className="ui-modal-footer">
                <button
                  type="button"
                  onClick={onDeleteEdit}
                  className="flex-1 rounded-[var(--radius-control)] border border-rose-100 bg-rose-50/40 px-4 py-3 text-sm font-semibold text-rose-500 transition active:scale-[0.99]"
                >
                  删除
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="ui-button-secondary flex-1 py-3 text-sm font-semibold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={onSaveEdit}
                  className="ui-button-primary flex-[1.25] py-3 text-sm font-semibold text-white transition active:scale-[0.99]"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
