"use client";

import { useMemo, useState } from "react";
import { useHomeResources } from "./HomeResourcesProvider.safe";
import {
  buildHeatmapDay,
  computeCoupleBonus,
  getCurrentIsoDate,
  gemsForPerson,
  parseNonNegativeInt,
  parseOptionalWeight,
  type SideLogInput,
} from "./settlement-rules";

function Field({
  label,
  value,
  onChange,
  unit,
  inputMode = "numeric",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="block min-w-0">
      <span className="text-[11px] font-semibold text-stone-600">{label}</span>
      <div className="mt-1 flex items-center gap-1.5 rounded-2xl border border-white/80 bg-white/65 px-3 py-2 shadow-inner shadow-rose-50/40 backdrop-blur-sm">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-stone-800 outline-none placeholder:text-stone-300"
          placeholder="0"
        />
        <span className="shrink-0 text-[11px] font-medium text-stone-400">{unit}</span>
      </div>
    </label>
  );
}

function previousDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function recordDate(record: { recordDate?: string; day: number }) {
  return record.recordDate ?? `2026-05-${String(record.day).padStart(2, "0")}`;
}

export function RecordTodaySettlement() {
  const { applyTodayRecord, dailyRecords, visualRules } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

  const today = useMemo(() => getCurrentIsoDate(), []);
  const todayDay = useMemo(() => new Date(today).getDate(), [today]);
  const yesterdayRecord = useMemo(() => {
    const yesterday = previousDate(today);
    return dailyRecords.find((record) => recordDate(record) === yesterday) ?? null;
  }, [dailyRecords, today]);

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
    const fg = gemsForPerson("fish", fishInput, yesterdayRecord);
    const cg = gemsForPerson("cat", catInput, yesterdayRecord);
    const couple = computeCoupleBonus(fishInput, catInput);
    return { fg, cg, couple };
  }, [catInput, fishInput, yesterdayRecord]);

  const hasAnyEffort =
    fishInput.deficit > 0 ||
    fishInput.minutes > 0 ||
    fishInput.weightKg != null ||
    catInput.deficit > 0 ||
    catInput.minutes > 0 ||
    catInput.weightKg != null;

  const onConfirm = () => {
    if (!hasAnyEffort) return;
    applyTodayRecord({
      day: todayDay,
      fish: fishInput,
      cat: catInput,
      fishHeat: buildHeatmapDay("fish", fishInput, visualRules),
      catHeat: buildHeatmapDay("cat", catInput, visualRules),
      fishGems: preview.fg,
      catGems: preview.cg,
      bonusGems: preview.couple.gems,
      coinDelta: 0,
    });
    setOpen(false);
    setFishW("");
    setCatW("");
    setFishD("0");
    setFishM("0");
    setCatD("0");
    setCatM("0");
    setToast("今天已经存好啦，明天继续并肩");
  };

  return (
    <>
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ui-button-primary relative w-full overflow-hidden px-6 py-3.5 text-base font-bold text-white ring-2 ring-rose-200/30 will-change-transform sm:py-4"
        >
          <span className="relative flex items-center justify-center gap-2 drop-shadow-sm">
            <span className="text-lg" aria-hidden>✦</span>
            记录今天
            <span className="text-lg" aria-hidden>✦</span>
          </span>
        </button>
        {toast ? <p className="text-center text-[11px] font-semibold text-rose-500">{toast}</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            aria-label="关闭"
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.45rem] border border-white/80 bg-gradient-to-b from-rose-50/98 via-white/90 to-amber-50/85 shadow-2xl shadow-rose-200/40">
            <div className="shrink-0 border-b border-rose-100/60 px-4 pb-3 pt-4 text-center">
              <p className="text-[10px] font-bold tracking-[0.2em] text-rose-400/90">今日收工啦</p>
              <h2 className="mt-1 text-lg font-bold text-stone-800">双人结算面板</h2>
              <p className="mt-1 text-xs text-stone-500">一起把今天轻轻收进小背包</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-rose-100/70 bg-gradient-to-b from-white/75 to-rose-50/40 p-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-bold text-stone-800">🐟 鱼鱼这边</p>
                  <Field label="今日体重" value={fishW} onChange={setFishW} inputMode="decimal" unit="kg" />
                  <Field label="运动时长" value={fishM} onChange={setFishM} unit="分钟" />
                  <Field label="热量缺口" value={fishD} onChange={setFishD} unit="kcal" />
                </div>
                <div className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-rose-100/70 bg-gradient-to-b from-white/75 to-rose-50/40 p-3 shadow-sm backdrop-blur-sm">
                  <p className="text-xs font-bold text-stone-800">🐱 猫猫这边</p>
                  <Field label="今日体重" value={catW} onChange={setCatW} inputMode="decimal" unit="kg" />
                  <Field label="运动时长" value={catM} onChange={setCatM} unit="分钟" />
                  <Field label="热量缺口" value={catD} onChange={setCatD} unit="kcal" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-100/80 bg-white/55 p-3.5 shadow-inner shadow-amber-50/50 backdrop-blur-sm">
                <p className="text-center text-[11px] font-bold text-amber-700/90">结算预览</p>
                <ul className="mt-3 space-y-2 text-xs font-semibold text-stone-700">
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5"><span>🐟 今日宝石</span><span className="tabular-nums text-rose-600">+{preview.fg}</span></li>
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-2.5 py-1.5"><span>🐱 今日宝石</span><span className="tabular-nums text-rose-600">+{preview.cg}</span></li>
                  <li className="flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-pink-50/80 to-amber-50/70 px-2.5 py-2"><span>情侣 bonus</span><span className="tabular-nums text-pink-600">{preview.couple.gems > 0 ? `+${preview.couple.gems}` : "—"}</span></li>
                </ul>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-2xl border border-white/80 bg-white/50 py-3 text-sm font-bold text-stone-500 transition hover:bg-white/80">下次再记</button>
                <button type="button" disabled={!hasAnyEffort} onClick={onConfirm} className="flex-[1.35] rounded-2xl border border-rose-200/80 bg-gradient-to-r from-rose-400 to-pink-400 py-3 text-sm font-bold text-white shadow-md shadow-rose-200/50 transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45">确认记录今天</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
