"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";
import {
  computeCoinPreview,
  computeCoupleBonus,
  gemBreakdownForPerson,
  getCurrentIsoDate,
  isInCoinWeek,
  parseNonNegativeInt,
  parseOptionalWeight,
  type SideLogInput,
} from "./settlement-rules";

function pad2(value: number) {
  return String(value).padStart(2, "0");
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
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function recordIsoDate(record: { recordDate?: string; day: number }) {
  return record.recordDate ?? `2026-05-${pad2(record.day)}`;
}

function totalRecordGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
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

function coinAmountLabel(value: number) {
  if (value > 0) return `🪙 +${value}`;
  return "🪙 0";
}

function CoinHintLine({ hint }: { hint: string }) {
  const line = formatCoinHint(hint);
  if (!line.trim()) return null;
  return <p className="growth-detail-extra-hint">{line}</p>;
}

function DetailLines({ lines }: { lines: string[] }) {
  const parts = formatBreakdownLines(lines);
  if (parts.length === 0) return null;
  return <p className="growth-detail-extra-hint">{parts.join(" · ")}</p>;
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
  inputMode?: "decimal" | "numeric" | "text";
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

type RecordTodayButtonVariant = "full" | "today" | "history";

type RecordTodaySettlementProps = {
  buttonVariant?: RecordTodayButtonVariant;
};

export function RecordTodaySettlement({
  buttonVariant = "full",
}: RecordTodaySettlementProps) {
  const { coinRules, dailyRecords, upsertDailyRecord, visualRules } =
    useHomeResources();
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const titleId = useId();

  // Must not freeze at mount: long sessions and cross-midnight need a fresh "today".
  const todayDate = getCurrentIsoDate();
  const [recordDate, setRecordDate] = useState(todayDate);
  const [fishW, setFishW] = useState("");
  const [fishD, setFishD] = useState("0");
  const [fishM, setFishM] = useState("0");
  const [catW, setCatW] = useState("");
  const [catD, setCatD] = useState("0");
  const [catM, setCatM] = useState("0");

  const existingRecord = useMemo(
    () =>
      dailyRecords.find((record) => recordIsoDate(record) === recordDate) ??
      null,
    [dailyRecords, recordDate],
  );

  const hydrateInputs = useCallback((record: DailyRecord | null) => {
    setFishW(record?.fish.weightKg == null ? "" : String(record.fish.weightKg));
    setFishD(String(record?.fish.deficit ?? 0));
    setFishM(String(record?.fish.minutes ?? 0));
    setCatW(record?.cat.weightKg == null ? "" : String(record.cat.weightKg));
    setCatD(String(record?.cat.deficit ?? 0));
    setCatM(String(record?.cat.minutes ?? 0));
  }, []);

  const openSheet = useCallback(() => {
    const date = todayDate;
    const record =
      dailyRecords.find((item) => recordIsoDate(item) === date) ?? null;
    setRecordDate(date);
    hydrateInputs(record);
    setOpen(true);
  }, [dailyRecords, hydrateInputs, todayDate]);

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

  const recordDay = useMemo(() => parseDateInputDay(recordDate), [recordDate]);
  const yesterdayRecord = useMemo(() => {
    const previousDate = previousDateInputValue(recordDate);
    if (!previousDate) return null;
    return (
      dailyRecords.find((record) => recordIsoDate(record) === previousDate) ??
      null
    );
  }, [dailyRecords, recordDate]);

  const preview = useMemo(() => {
    const fishBreakdown = gemBreakdownForPerson(
      "fish",
      fishInput,
      yesterdayRecord,
    );
    const catBreakdown = gemBreakdownForPerson(
      "cat",
      catInput,
      yesterdayRecord,
    );
    const couple = computeCoupleBonus(fishInput, catInput);
    const recordsWithoutExisting = existingRecord
      ? dailyRecords.filter((record) => record.id !== existingRecord.id)
      : dailyRecords;
    const weekGemTotalForDate = recordsWithoutExisting.reduce(
      (total, record) =>
        isInCoinWeek(recordIsoDate(record), recordDate, coinRules.weekStartDay) &&
        recordIsoDate(record) < recordDate
          ? total + totalRecordGems(record)
          : total,
      0,
    );
    const todayGemTotal =
      fishBreakdown.total + catBreakdown.total + couple.gems;
    const coin = computeCoinPreview({
      fish: fishInput,
      cat: catInput,
      todayDay: recordDay ?? 1,
      todayDate: recordDate,
      todayGemTotal,
      currentWeekGemTotal: weekGemTotalForDate,
      dailyRecords: recordsWithoutExisting,
      coinRules,
      visualRules,
    });
    return {
      fg: fishBreakdown.total,
      cg: catBreakdown.total,
      fishBreakdown,
      catBreakdown,
      couple,
      coin,
    };
  }, [
    catInput,
    coinRules,
    dailyRecords,
    existingRecord,
    fishInput,
    recordDate,
    recordDay,
    visualRules,
    yesterdayRecord,
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

  useEffect(() => {
    if (!open) {
      let cancelled = false;
      const id = requestAnimationFrame(() => {
        if (!cancelled) setEntered(false);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(id);
      };
    }
    let cancelled = false;
    const outerId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setEntered(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outerId);
    };
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
    if (!hasAnyEffort || recordDay == null) return;
    const result = upsertDailyRecord(recordDate, fishInput, catInput);
    if (!result.ok) {
      setToast(
        result.reason === "future-date" ? "只能记到今天哦" : "日期有点不对",
      );
      return;
    }
    setOpen(false);
    setToast(
      recordDate === todayDate
        ? "今天已经存好啦，明天继续并肩"
        : result.updatedExisting
          ? "这一天已经更新完成"
          : "这一天已经补录完成",
    );
  }, [
    catInput,
    fishInput,
    hasAnyEffort,
    recordDate,
    recordDay,
    todayDate,
    upsertDailyRecord,
  ]);

  const buttonLabel = buttonVariant === "history" ? "补录记录" : "记录今天";

  return (
    <>
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={openSheet}
          className={
            buttonVariant === "history"
              ? "ui-nav-button inline-flex w-full whitespace-nowrap text-sm"
              : "ui-button-primary relative w-full overflow-hidden px-6 py-3.5 text-base font-semibold text-white will-change-transform sm:py-4"
          }
        >
          <span className="relative flex items-center justify-center gap-2 drop-shadow-sm">
            {buttonVariant === "history" ? <span aria-hidden>📝</span> : null}
            {buttonLabel}
          </span>
        </button>
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
            className={`ui-sheet growth-record-day-sheet relative flex max-h-[min(92dvh,640px)] w-full max-w-lg flex-col overflow-hidden transition-all duration-300 ease-out ${
              entered
                ? "translate-y-0 opacity-100 sm:scale-100"
                : "translate-y-6 opacity-0 sm:translate-y-0 sm:scale-95"
            }`}
          >
            <div className="ui-modal-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.2em] ui-text-primary">
                {recordDate === todayDate ? "今日收工啦" : "补录这一天"}
              </p>
              <h2 id={titleId} className="mt-1 text-lg font-bold ui-text-main">
                {recordDate === todayDate ? "今天的小记录" : "保存这一天"}
              </h2>
              <p className="mt-1 text-xs font-medium ui-text-muted">
                把今天轻轻存起来
              </p>
            </div>

            <div className="ui-modal-body">
              <label className="mb-3 block">
                <span className="ui-field-label">记录日期</span>
                <input
                  type="date"
                  value={recordDate}
                  max={todayDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    const nextRecord =
                      dailyRecords.find(
                        (record) => recordIsoDate(record) === nextDate,
                      ) ?? null;
                    setRecordDate(nextDate);
                    hydrateInputs(nextRecord);
                  }}
                  className="ui-input mt-1 w-full px-3 py-2.5 text-sm font-semibold outline-none"
                />
              </label>

              <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5">
                <PartnerColumn
                  emoji="🐟"
                  title="鱼鱼"
                  weight={fishW}
                  setWeight={setFishW}
                  deficit={fishD}
                  setDeficit={setFishD}
                  minutes={fishM}
                  setMinutes={setFishM}
                />
                <PartnerColumn
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

              <div className="ui-soft-panel ui-card-item mt-3">
                <p className="text-center text-[11px] font-bold ui-text-reward">
                  这一天的小奖励
                </p>
                <ul className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-xs font-semibold ui-text-main">
                  <li className="growth-detail-extra-card">
                    <span className="flex items-center justify-between gap-2">
                      <span aria-hidden>🐟</span>
                      <span className="tabular-nums ui-text-primary">
                        💎 +{preview.fg}
                      </span>
                    </span>
                    <DetailLines lines={preview.fishBreakdown.lines} />
                  </li>
                  <li className="growth-detail-extra-card">
                    <span className="flex items-center justify-between gap-2">
                      <span aria-hidden>🐱</span>
                      <span className="tabular-nums ui-text-primary">
                        💎 +{preview.cg}
                      </span>
                    </span>
                    <DetailLines lines={preview.catBreakdown.lines} />
                  </li>
                  <li className="growth-detail-extra-card">
                    <div className="growth-detail-extra-row">
                      <span className="growth-detail-extra-title">🔥 一起加成</span>
                      {preview.couple.gems > 0 ? (
                        <span className="growth-detail-extra-value-pill ui-chip-primary ui-text-primary">
                          💎 +{preview.couple.gems}
                        </span>
                      ) : (
                        <span className="growth-detail-extra-value growth-detail-extra-value--muted">
                          未点亮
                        </span>
                      )}
                    </div>
                    <p className="growth-detail-extra-hint">
                      {preview.couple.gems > 0 ? "一起点亮" : "满 30 分钟时点亮"}
                    </p>
                  </li>
                  <li className="growth-detail-extra-card">
                    <div className="growth-detail-extra-row">
                      <span className="growth-detail-extra-title">🪙 金币</span>
                      <span className="growth-detail-extra-value-pill ui-chip-reward ui-text-reward">
                        {coinAmountLabel(preview.coin.delta)}
                      </span>
                    </div>
                    <CoinHintLine hint={preview.coin.hint} />
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
                  disabled={
                    !hasAnyEffort || recordDay == null || recordDate > todayDate
                  }
                  onClick={onConfirm}
                  className="ui-button-primary flex-[1.35] py-3 text-sm font-semibold text-white transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {recordDate === todayDate ? "存好今天" : "保存这一天"}
                </button>
              </div>
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
