"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useHomeResources } from "./HomeResourcesProvider";
import {
  buildHeatmapDay,
  computeCoinPreview,
  computeCoupleBonus,
  gemsForPerson,
  getMaySettlementDay,
  parseNonNegativeInt,
  parseOptionalWeight,
  type SideLogInput,
} from "./settlement-rules";

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
  onChange: (v: string) => void;
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
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-stone-800 outline-none placeholder:text-stone-300"
          placeholder="—"
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
  setWeight: (v: string) => void;
  deficit: string;
  setDeficit: (v: string) => void;
  minutes: string;
  setMinutes: (v: string) => void;
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

export function RecordTodaySettlement() {
  const { applyTodayRecord } = useHomeResources();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const titleId = useId();

  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

  const fishInput: SideLogInput = useMemo(
    () => ({
      weightKg: parseOptionalWeight(fishW),
      deficit: parseNonNegativeInt(fishD),
      minutes: parseNonNegativeInt(fishM),
    }),
    [fishW, fishD, fishM],
  );

  const catInput: SideLogInput = useMemo(
    () => ({
      weightKg: parseOptionalWeight(catW),
      deficit: parseNonNegativeInt(catD),
      minutes: parseNonNegativeInt(catM),
    }),
    [catW, catD, catM],
  );

  const preview = useMemo(() => {
    const fg = gemsForPerson(fishInput);
    const cg = gemsForPerson(catInput);
    const couple = computeCoupleBonus(fishInput, catInput);
    const coupleOn = couple.gems > 0;
    const coin = computeCoinPreview(fishInput, catInput, coupleOn);
    return { fg, cg, couple, coupleOn, coin };
  }, [fishInput, catInput]);

  const hasAnyEffort = useMemo(() => {
    return (
      fishInput.deficit > 0 ||
      fishInput.minutes > 0 ||
      fishInput.weightKg != null ||
      catInput.deficit > 0 ||
      catInput.minutes > 0 ||
      catInput.weightKg != null
    );
  }, [fishInput, catInput]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onConfirm = useCallback(() => {
    if (!hasAnyEffort) return;
    const fg = gemsForPerson(fishInput);
    const cg = gemsForPerson(catInput);
    const couple = computeCoupleBonus(fishInput, catInput);
    const coupleOn = couple.gems > 0;
    const coin = computeCoinPreview(fishInput, catInput, coupleOn);
    const day = getMaySettlementDay();
    applyTodayRecord({
      day,
      fishHeat: buildHeatmapDay(fishInput),
      catHeat: buildHeatmapDay(catInput),
      fishGems: fg,
      catGems: cg,
      bonusGems: couple.gems,
      coinDelta: coin.delta,
    });
    setOpen(false);
    setFishW("");
    setCatW("");
    setFishD("0");
    setCatD("0");
    setFishM("0");
    setCatM("0");
    setToast("今日已温柔存档～ 明天继续并肩 ✨");
  }, [applyTodayRecord, catInput, fishInput, hasAnyEffort]);

  return (
    <>
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative w-full overflow-hidden rounded-full border border-white/60 bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-rose-200/50 ring-2 ring-rose-200/30 transition will-change-transform hover:shadow-xl hover:shadow-rose-300/35 active:scale-[0.97] active:brightness-[1.02] sm:py-4"
        >
          <span className="relative flex items-center justify-center gap-2 drop-shadow-sm">
            <span className="text-lg" aria-hidden>
              ✨
            </span>
            记录今天
            <span className="text-lg" aria-hidden>
              ✨
            </span>
          </span>
        </button>
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
                今日收工啦
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold text-stone-800">
                双人结算面板
              </h2>
              <p className="mt-1 text-xs text-stone-500">
                一边是 🐟，一边是 🐱，一起把今天收进小背包
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <PartnerColumn
                  emoji="🐟"
                  title="小鱼这边"
                  weight={fishW}
                  setWeight={setFishW}
                  deficit={fishD}
                  setDeficit={setFishD}
                  minutes={fishM}
                  setMinutes={setFishM}
                />
                <PartnerColumn
                  emoji="🐱"
                  title="小猫这边"
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
                      <span>🤝 情侣 bonus</span>
                      <span className="tabular-nums text-pink-600">
                        {preview.couple.gems > 0
                          ? `+${preview.couple.gems}`
                          : "—"}
                      </span>
                    </div>
                    {preview.couple.reasons.length > 0 ? (
                      <p className="text-[10px] font-medium leading-relaxed text-stone-500">
                        {preview.couple.reasons.join(" · ")}
                      </p>
                    ) : (
                      <p className="text-[10px] font-medium text-stone-400">
                        一起运动（各≥20分）或双人缺口≥300 可触发
                      </p>
                    )}
                  </li>
                  <li className="flex flex-col gap-0.5 rounded-xl bg-amber-50/55 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span>🪙 金币变化</span>
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
