"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  useHomeResources,
  type DailyRecord,
} from "./HomeResourcesProvider";
import {
  computeCoinPreview,
  computeCoupleBonus,
  gemsForPerson,
  isInCoinWeek,
  parseNonNegativeInt,
} from "./settlement-rules";

type GrowthLogEntry = DailyRecord;

function totalGems(entry: GrowthLogEntry) {
  return entry.fish.gems + entry.cat.gems + entry.bonus;
}

function recordIsoDate(entry: GrowthLogEntry) {
  return entry.recordDate;
}

function totalRecordGems(entry: GrowthLogEntry) {
  return entry.fish.gems + entry.cat.gems + entry.bonus;
}

function PartnerLine({
  emoji,
  deficit,
  minutes,
  gems,
}: {
  emoji: string;
  deficit: number;
  minutes: number;
  gems: number;
}) {
  return (
    <div className="rounded-2xl border border-stone-100/80 bg-white/55 px-3 py-2 shadow-inner shadow-stone-100/45">
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-stone-500">
        <span>{emoji} 热量缺口</span>
        <span className="tabular-nums text-stone-700">{deficit} kcal</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-stone-500">
        <span>运动时长</span>
        <span className="tabular-nums text-stone-700">{minutes} 分钟</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-medium text-stone-500">
        <span>获得宝石</span>
        <span className="tabular-nums text-rose-500">+{gems}</span>
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  unit,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-semibold text-stone-600">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 rounded-2xl border border-white/80 bg-white/65 px-3 py-2 shadow-inner shadow-rose-50/40">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="numeric"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-stone-800 outline-none"
        />
        <span className="shrink-0 text-[11px] font-medium text-stone-400">
          {unit}
        </span>
      </div>
    </label>
  );
}

function EditPartnerCard({
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
        <EditField
          label="热量缺口"
          value={deficit}
          onChange={setDeficit}
          unit="kcal"
        />
        <EditField
          label="运动时长"
          value={minutes}
          onChange={setMinutes}
          unit="分钟"
        />
      </div>
    </div>
  );
}

function LogCard({
  entry,
  onView,
}: {
  entry: GrowthLogEntry;
  onView: (entry: GrowthLogEntry) => void;
}) {
  return (
    <article className="rounded-[1.2rem] border border-white/70 bg-white/58 px-3 py-3 shadow-sm shadow-rose-100/30 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-rose-100/80 via-stone-200/70 to-amber-100/80" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold tracking-tight text-stone-600">
              {entry.date}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-stone-400">
              轻轻记下一笔成长
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-rose-100/70 bg-rose-50/70 px-2 py-1 text-[10px] font-semibold text-rose-500">
            💎 +{totalGems(entry)}
          </span>
          <span className="rounded-full border border-amber-200/70 bg-amber-50/75 px-2 py-1 text-[10px] font-semibold text-amber-500">
            🪙 {entry.coins > 0 ? `+${entry.coins}` : "0"}
          </span>
          <button
            type="button"
            onClick={() => onView(entry)}
            className="ui-button-secondary px-3 py-1.5 text-[11px] font-semibold text-stone-600"
            aria-label={`查看 ${entry.date} 成长日志`}
          >
            查看
          </button>
        </div>
      </div>
    </article>
  );
}

function DetailSheet({
  entry,
  previousRecord,
  dailyRecords,
  onClose,
}: {
  entry: GrowthLogEntry;
  previousRecord: GrowthLogEntry | null;
  dailyRecords: GrowthLogEntry[];
  onClose: () => void;
}) {
  const { coinRules, upsertHistoricalRecord, visualRules } = useHomeResources();
  const detailTitleId = useId();
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fishDeficit, setFishDeficit] = useState(String(entry.fish.deficit));
  const [fishMinutes, setFishMinutes] = useState(String(entry.fish.minutes));
  const [catDeficit, setCatDeficit] = useState(String(entry.cat.deficit));
  const [catMinutes, setCatMinutes] = useState(String(entry.cat.minutes));

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const preview = useMemo(() => {
    const fish = {
      weightKg: entry.fish.weightKg,
      deficit: parseNonNegativeInt(fishDeficit),
      minutes: parseNonNegativeInt(fishMinutes),
    };
    const cat = {
      weightKg: entry.cat.weightKg,
      deficit: parseNonNegativeInt(catDeficit),
      minutes: parseNonNegativeInt(catMinutes),
    };
    const fg = gemsForPerson("fish", fish, previousRecord);
    const cg = gemsForPerson("cat", cat, previousRecord);
    const couple = computeCoupleBonus(fish, cat);
    const recordsWithoutCurrent = dailyRecords.filter(
      (record) => record.id !== entry.id,
    );
    const weekGemTotal = recordsWithoutCurrent.reduce(
      (total, record) =>
        isInCoinWeek(
          recordIsoDate(record),
          entry.recordDate,
          coinRules.weekStartDay,
        )
          ? total + totalRecordGems(record)
          : total,
      0,
    );
    const coin = computeCoinPreview({
      fish,
      cat,
      todayDay: entry.day,
      todayDate: entry.recordDate,
      todayGemTotal: fg + cg + couple.gems,
      currentWeekGemTotal: weekGemTotal,
      dailyRecords: recordsWithoutCurrent,
      coinRules,
      visualRules,
    });
    return { fish, cat, fg, cg, couple, coin };
  }, [
    catDeficit,
    catMinutes,
    coinRules,
    dailyRecords,
    entry,
    fishDeficit,
    fishMinutes,
    previousRecord,
    visualRules,
  ]);

  const onSave = useCallback(() => {
    const result = upsertHistoricalRecord({
      recordDate: entry.recordDate,
      fish: preview.fish,
      cat: preview.cat,
    });
    if (!result.ok) {
      setToast("保存失败");
      return;
    }
    setEditing(false);
    setToast("这一天已经更新");
  }, [entry.recordDate, preview.cat, preview.fish, upsertHistoricalRecord]);

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-stone-900/12 px-1 pb-1 backdrop-blur-[1px] sm:items-center sm:p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={detailTitleId}
        className="w-full max-w-md rounded-[1.25rem] border border-white/85 bg-gradient-to-b from-white/96 to-amber-50/88 p-3.5 shadow-xl shadow-stone-300/25"
      >
        <div className="flex items-start justify-between gap-3 border-b border-stone-100/80 pb-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-stone-400">
              成长记录
            </p>
            <h3
              id={detailTitleId}
              className="mt-0.5 text-lg font-bold tracking-tight text-stone-800"
            >
              {entry.date}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500"
          >
            返回
          </button>
        </div>

        {editing ? (
          <>
            <div className="mt-3 space-y-2.5">
              <EditPartnerCard
                emoji="🐟"
                title="鱼鱼"
                deficit={fishDeficit}
                setDeficit={setFishDeficit}
                minutes={fishMinutes}
                setMinutes={setFishMinutes}
              />
              <EditPartnerCard
                emoji="🐱"
                title="猫猫"
                deficit={catDeficit}
                setDeficit={setCatDeficit}
                minutes={catMinutes}
                setMinutes={setCatMinutes}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-rose-100/75 bg-rose-50/55 px-3 py-2">
                <p className="text-[10px] font-semibold text-stone-500">
                  双方宝石
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-stone-700">
                  🐟 +{preview.fg} / 🐱 +{preview.cg}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold text-stone-500">
                  奖励变化
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-stone-700">
                  bonus +{preview.couple.gems} / 金币{" "}
                  {preview.coin.delta > 0 ? `+${preview.coin.delta}` : "0"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex-1 rounded-2xl border border-stone-200/70 bg-white/55 py-2.5 text-xs font-semibold text-stone-500 transition hover:bg-white/80"
              >
                取消编辑
              </button>
              <button
                type="button"
                onClick={onSave}
                className="flex-1 rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-400 to-pink-400 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-200/50"
              >
                保存这一天
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <PartnerLine emoji="🐟" {...entry.fish} />
              <PartnerLine emoji="🐱" {...entry.cat} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-rose-100/75 bg-rose-50/55 px-3 py-2">
                <p className="text-[10px] font-semibold text-stone-500">
                  情侣 bonus
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-stone-700">
                  +{entry.bonus}
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold text-stone-500">
                  金币变化
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-stone-700">
                  {entry.coins > 0 ? `+${entry.coins}` : "0"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex-1 rounded-2xl border border-stone-200/70 bg-white/55 py-2.5 text-xs font-semibold text-stone-500 transition hover:bg-white/80"
              >
                编辑这一天
              </button>
              <button
                type="button"
                disabled
                className="flex-1 rounded-2xl border border-rose-100/75 bg-rose-50/45 py-2.5 text-xs font-semibold text-stone-400"
              >
                删除记录
              </button>
            </div>
          </>
        )}

        {toast ? (
          <p className="mt-3 text-center text-[11px] font-semibold text-rose-500">
            {toast}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function GrowthLog() {
  const { dailyRecords } = useHomeResources();
  const sortedRecords = useMemo(
    () =>
      [...dailyRecords].sort((a, b) =>
        (b.recordDate ?? "").localeCompare(a.recordDate ?? ""),
      ),
    [dailyRecords],
  );
  const [open, setOpen] = useState(false);
  const [sheetEnter, setSheetEnter] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GrowthLogEntry | null>(
    null,
  );
  const titleId = useId();

  const previousRecord = useMemo(() => {
    if (!selectedEntry) return null;
    const date = new Date(selectedEntry.recordDate);
    date.setDate(date.getDate() - 1);
    const previousIso = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return (
      dailyRecords.find((record) => record.recordDate === previousIso) ?? null
    );
  }, [dailyRecords, selectedEntry]);

  const closeSheet = () => {
    setSelectedEntry(null);
    setSheetEnter(false);
    setOpen(false);
  };

  const openSheet = () => {
    setSelectedEntry(null);
    setSheetEnter(false);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setSheetEnter(true)),
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
      if (event.key === "Escape") {
        if (selectedEntry) {
          setSelectedEntry(null);
          return;
        }
        closeSheet();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, selectedEntry]);

  return (
    <>
      <div className="w-full">
        <button
          type="button"
          onClick={openSheet}
          className="ui-button-secondary group flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-stone-600 shadow-sm shadow-rose-100/25 transition duration-200 hover:-translate-y-0.5 hover:bg-white/85 active:translate-y-0"
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="text-base" aria-hidden>
              📖
            </span>
            <span className="truncate">成长日志</span>
          </span>
          <span className="shrink-0 text-[11px] font-semibold text-stone-400 transition group-hover:text-rose-500">
            查看
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="关闭成长日志"
            className={`absolute inset-0 bg-stone-900/30 backdrop-blur-[2px] transition-opacity duration-300 ${
              sheetEnter ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeSheet}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={`relative flex h-[78dvh] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 px-4 pt-3 shadow-2xl shadow-rose-200/40 transition-all duration-300 ease-out will-change-transform ${
              sheetEnter
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-full opacity-90 sm:translate-y-2 sm:scale-95"
            } pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/70" aria-hidden />

            <div className="relative overflow-hidden rounded-[1.15rem] border border-white/75 bg-gradient-to-r from-rose-50/85 via-white/82 to-amber-50/70 px-3.5 py-3 shadow-sm shadow-rose-100/40">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/40 blur-xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2
                    id={titleId}
                    className="mt-0.5 text-base font-bold text-stone-800"
                  >
                    📖 成长日志
                  </h2>
                  <p className="mt-0.5 text-[11px] font-medium text-stone-500">
                    看看我们一起攒下的小脚印
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="ui-button-secondary shrink-0 px-3 py-1 text-xs font-semibold text-stone-500"
                >
                  收起
                </button>
              </div>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
              {sortedRecords.length > 0 ? (
                <div className="space-y-2">
                  {sortedRecords.map((entry) => (
                    <LogCard
                      key={entry.id}
                      entry={entry}
                      onView={setSelectedEntry}
                    />
                  ))}
                </div>
              ) : (
                <div className="ui-card-soft flex min-h-52 flex-col items-center justify-center px-5 py-8 text-center">
                  <span className="text-3xl" aria-hidden>
                    ✦
                  </span>
                  <p className="mt-3 text-sm font-semibold text-stone-600">
                    还没有成长日志，今天开始攒第一颗星
                  </p>
                </div>
              )}
            </div>

            {selectedEntry ? (
              <DetailSheet
                key={selectedEntry.id}
                entry={selectedEntry}
                previousRecord={previousRecord}
                dailyRecords={dailyRecords}
                onClose={() => setSelectedEntry(null)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
