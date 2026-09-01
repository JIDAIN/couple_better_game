"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
import { hasMeaningfulGrowthActivity } from "@/lib/home/daily-record-utils";
import { Title } from "animal-island-ui";
import { AppButton, AppCard, AppCurrencyChip, AppGameIcon, AppInput, AppModal, AppRoleAvatar, AppToast } from "../ui";
import type { RoleKind } from "../ui";

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
    缺口金币: "缺口",
    运动金币: "运动",
    恢复日奖励: "恢复",
  };
  const formatted = lines
    .map((line) => {
      const match = /^(缺口宝石|运动宝石|缺口金币|运动金币|恢复日奖励) \+(\d+)$/.exec(line);
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
  if (hint === "本日暂未触发金币规则" || hint === "本日暂未触发宝石规则") return "还没点亮";
  return hint
    .split(" · ")
    .map((part) =>
      part
        .replace(/本周新增宝石达到 30：\+1/g, "本周达标")
        .replace(/本周新增宝石达到 50：再 \+1/g, "本周进阶")
        .replace(/本周新增金币达到 30：\+1/g, "本周达标")
        .replace(/本周新增金币达到 50：再 \+1/g, "本周进阶")
        .replace(/双人连续 \d+ 天达到一般打卡：\+1/g, "连续坚持")
        .replace(/本周一起运动达到 2 次：\+1/g, "一起运动"),
    )
    .join(" · ");
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
      {active ? "一起点亮" : "一起运动 30min 点亮"}
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
      <div className="app-compact-control">
        <AppInput
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          inputSize="small"
          placeholder="0"
          suffix={unit}
          className="record-compact-input"
        />
      </div>
    </label>
  );
}

function PersonDetailCard({
  role,
  deficit,
  minutes,
  gems,
  lines,
}: {
  role: RoleKind;
  deficit: number;
  minutes: number;
  gems: number;
  lines: string[];
}) {
  const note = personGemNoteFromLines(lines);
  return (
    <div className="growth-detail-extra-card growth-person-detail-card">
      <div className="growth-person-detail-head">
        <p className="growth-person-detail-role">
          <AppRoleAvatar role={role} size={14} />
        </p>
        <AppCurrencyChip currency="coin" value={gems} size="sm" />
      </div>
      <div className="growth-person-detail-metrics">
        <div className="growth-person-detail-metric">
          <span>缺口</span>
          <strong>{deficit} kcal</strong>
        </div>
        <div className="growth-person-detail-metric">
          <span>运动</span>
          <strong>{minutes} min</strong>
        </div>
      </div>
      {note ? <p className="growth-detail-extra-hint">{note}</p> : null}
    </div>
  );
}

function EditSide({
  role,
  weight,
  setWeight,
  deficit,
  setDeficit,
  minutes,
  setMinutes,
}: {
  role: RoleKind;
  weight: string;
  setWeight: (value: string) => void;
  deficit: string;
  setDeficit: (value: string) => void;
  minutes: string;
  setMinutes: (value: string) => void;
}) {
  const title = role === "fish" ? "鱼鱼" : "猫猫";
  return (
    <AppCard variant="panel" className="growth-partner-form flex min-w-0 flex-col">
      <p className="text-[11px] font-bold ui-text-main">
        <AppRoleAvatar role={role} size={16} /> {title}
      </p>
      <CompactField
        label="体重"
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
    </AppCard>
  );
}

export function GrowthLogLedgerRow({
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
      className="growth-log-ledger-row"
    >
      <span className="growth-log-ledger-date">{formatMonthDay(entry.recordDate)}</span>
      <AppCurrencyChip currency="coin" value={totalGems(entry)} size="sm" />
      <AppCurrencyChip currency="gem" value={entry.coins} size="sm" />
      <span className="growth-log-detail-link">详情</span>
    </button>
  );
}

export function GrowthRecordDetailModal({
  record,
  onClose,
}: {
  record: DailyRecord | null;
  onClose: () => void;
}) {
  const { coinRules, dailyRecords, visualRules } = useHomeResources();
  const detailInput = useMemo(
    () =>
      record
        ? {
            record,
            fish: sideInputFromRecord(record, "fish"),
            cat: sideInputFromRecord(record, "cat"),
          }
        : null,
    [record],
  );
  const detailPreview = useSettlementPreview({
    coinRules,
    dailyRecords,
    input: detailInput,
    visualRules,
  });

  return (
    <AppModal
      open={Boolean(record)}
      onClose={onClose}
      maskClosable
      width="min(92vw, 30rem)"
      title={
        record ? (
          <div className="app-dialog-header shrink-0">
            <p className="text-[10px] font-bold tracking-[0.18em] ui-text-primary">
              记录详情
            </p>
            <Title size="small" color="app-yellow" className="mt-1">
              {formatFullDate(record.recordDate)}
            </Title>
            <p className="mt-1 text-xs font-medium ui-text-muted">
              今天也攒下了一点闪光
            </p>
          </div>
        ) : null
      }
      footer={
        record && detailPreview ? (
          <div className="app-dialog-footer">
            <AppButton
              type="button"
              onClick={onClose}
              className="is-secondary flex-1 py-3 text-sm font-semibold"
            >
              关闭
            </AppButton>
          </div>
        ) : null
      }
    >
      {record && detailPreview ? (
        <div className="app-modal-scroll-body app-modal-scroll-body--growth-detail">
          <div className="growth-log-detail-stack">
            <div className="growth-detail-summary">
              <AppCurrencyChip currency="coin" value={totalGems(record)} />
              <AppCurrencyChip currency="gem" value={record.coins} />
            </div>

            <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5">
              <PersonDetailCard
                role="fish"
                deficit={record.fish.deficit}
                minutes={record.fish.minutes}
                gems={record.fish.gems}
                lines={detailPreview.fishBreakdown.lines}
              />
              <PersonDetailCard
                role="cat"
                deficit={record.cat.deficit}
                minutes={record.cat.minutes}
                gems={record.cat.gems}
                lines={detailPreview.catBreakdown.lines}
              />
            </div>

            <AppCard variant="panel" className="mt-3">
              <p className="text-center text-[11px] font-bold ui-text-reward">
                这一天的小奖励
              </p>
              <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
                <div className="growth-detail-extra-card">
                  <div className="growth-detail-extra-row">
                    <span className="growth-detail-extra-title">
                      <AppRoleAvatar role="fish" size={14} /><AppRoleAvatar role="cat" size={14} />
                    </span>
                    <AppCurrencyChip currency="coin" value={record.bonus} size="sm" />
                  </div>
                  <BonusHintText active={record.bonus > 0} />
                </div>
                <div className="growth-detail-extra-card">
                  <div className="growth-detail-extra-row">
                    <span className="growth-detail-extra-title">
                      <AppGameIcon name="gem" size={14} /> 宝石
                    </span>
                    <AppCurrencyChip currency="gem" value={record.coins} size="sm" />
                  </div>
                  <CoinHintText hint={detailPreview.coin.hint} />
                </div>
              </div>
            </AppCard>
          </div>
        </div>
      ) : null}
    </AppModal>
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

export function GrowthLog({
  variant = "button",
}: {
  variant?: "button" | "inline";
}) {
  const {
    coinRules,
    dailyRecords,
    deleteDailyRecord,
    updateDailyRecord,
    visualRules,
  } = useHomeResources();
  const isInline = variant === "inline";
  const [open, setOpen] = useState(false);
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
  const monthTouchedRef = useRef(false);
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
        .filter(hasMeaningfulGrowthActivity)
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
    if (monthTouchedRef.current) return;
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
    setOpen(false);
  };

  const onPrevMonth = () => {
    monthTouchedRef.current = true;
    setViewMonth((current) => addMonths(current, -1));
  };
  const onNextMonth = () => {
    monthTouchedRef.current = true;
    setViewMonth((current) => addMonths(current, 1));
  };

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

  const listBody = (
    <>
      <div className="record-sheet-header growth-log-page-header">
        {!isInline ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold leading-6 tracking-tight ui-text-main">
                <span aria-hidden><AppGameIcon name="log" size={18} /></span> 成长日志
              </p>
              <p className="text-xs font-medium leading-4 ui-text-soft">
                一起攒下的每一天
              </p>
            </div>
            <AppButton
              type="button"
              onClick={closeSheet}
              className="is-secondary shrink-0 px-3 py-1 text-xs font-semibold"
            >
              收起
            </AppButton>
          </div>
        ) : null}

        <div className={isInline ? "flex justify-center" : "mt-2 flex justify-center"}>
          <div className="app-input-shell inline-flex items-center gap-4 px-4 py-1.5">
            <AppButton
              type="button"
              onClick={onPrevMonth}
              className="is-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
              aria-label="查看上个月"
            >
              ‹
            </AppButton>
            <span className="min-w-[7.2rem] text-center text-sm font-bold ui-text-main">
              {formatMonthLabel(viewMonth)}
            </span>
            <AppButton
              type="button"
              onClick={onNextMonth}
              className="is-ghost inline-flex h-7 w-7 items-center justify-center text-sm font-bold leading-none"
              aria-label="查看下个月"
            >
              ›
            </AppButton>
          </div>
        </div>
      </div>

      <div className={`record-sheet-body ${isInline ? "growth-log-list-body--inline" : ""}`}>
        {sortedRecords.length > 0 ? (
          <div className="growth-log-notebook-list">
            {sortedRecords.map((entry) => (
              <GrowthLogLedgerRow key={entry.id} entry={entry} onOpen={openDetail} />
            ))}
          </div>
        ) : (
          <AppCard variant="item" className="flex h-full min-h-[12rem] items-center justify-center py-8 text-center text-sm font-semibold ui-text-muted">
            这个月还没有成长记录
          </AppCard>
        )}
      </div>
    </>
  );

  const listContent = isInline ? (
    <div className="growth-log-notebook">{listBody}</div>
  ) : (
    <AppCard variant="panel" className="growth-log-notebook">
      {listBody}
    </AppCard>
  );

  return (
    <>
      {!isInline ? (
        <AppButton
          type="button"
          onClick={() => setOpen(true)}
          className="is-nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <AppGameIcon name="log" size={16} />
          <span>成长日志</span>
        </AppButton>
      ) : null}

      {isInline ? listContent : null}

      <AppModal
        open={!isInline && open}
        onClose={closeSheet}
        maskClosable
        width="min(92vw, 30rem)"
        footer={null}
      >
        <div className="app-modal-scroll-body">{listContent}</div>
      </AppModal>

      <AppModal
        open={Boolean(selectedRecord)}
        onClose={closeDetail}
        maskClosable
        width="min(92vw, 30rem)"
        title={
          selectedRecord ? (
            <div className="app-dialog-header shrink-0">
              <p className="text-[10px] font-bold tracking-[0.18em] ui-text-primary">
                {detailMode === "detail" ? "记录详情" : "修改这一天"}
              </p>
              <Title size="small" color="app-yellow" className="mt-1">
                {formatFullDate(selectedRecord.recordDate)}
              </Title>
              <p className="mt-1 text-xs font-medium ui-text-muted">
                {detailMode === "detail"
                  ? "今天也攒下了一点闪光"
                  : "轻轻改就好"}
              </p>
            </div>
          ) : null
        }
        footer={
          selectedRecord && detailMode === "detail" && detailPreview ? (
            <div className="app-dialog-footer">
              <AppButton
                type="button"
                onClick={closeDetail}
                className="is-secondary flex-1 py-3 text-sm font-semibold"
              >
                关闭
              </AppButton>
              <AppButton
                type="button"
                onClick={enterEditMode}
                className="is-primary flex-[1.2] py-3 text-sm font-semibold transition active:scale-[0.99]"
              >
                编辑
              </AppButton>
            </div>
          ) : selectedRecord && detailMode === "edit" && editPreview ? (
            <div className="growth-log-edit-footer">
              <AppButton
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                variant="ghost"
                className="growth-log-delete-btn"
              >
                删除
              </AppButton>
              <div className="growth-log-edit-footer-actions">
                <AppButton
                  type="button"
                  onClick={() => {
                    if (selectedRecord) hydrateEditFields(selectedRecord);
                    setDetailMode("detail");
                  }}
                  className="is-secondary min-w-0 flex-1 py-2.5 text-sm font-semibold sm:flex-none sm:px-5"
                >
                  取消编辑
                </AppButton>
                <AppButton
                  type="button"
                  onClick={onSaveEdit}
                  className="is-primary min-w-0 flex-[1.2] py-2.5 text-sm font-semibold transition active:scale-[0.99] sm:flex-none sm:px-6"
                >
                  保存修改
                </AppButton>
              </div>
            </div>
          ) : null
        }
      >
        {selectedRecord ? (
            <div className="app-modal-scroll-body app-modal-scroll-body--growth-detail">
              {detailMode === "detail" && detailPreview ? (
                <div className="growth-log-detail-stack">
                  <div className="growth-detail-summary">
                    <AppCurrencyChip currency="coin" value={totalGems(selectedRecord)} />
                    <AppCurrencyChip currency="gem" value={selectedRecord.coins} />
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5">
                    <PersonDetailCard
                      role="fish"
                      deficit={selectedRecord.fish.deficit}
                      minutes={selectedRecord.fish.minutes}
                      gems={selectedRecord.fish.gems}
                      lines={detailPreview.fishBreakdown.lines}
                    />
                    <PersonDetailCard
                      role="cat"
                      deficit={selectedRecord.cat.deficit}
                      minutes={selectedRecord.cat.minutes}
                      gems={selectedRecord.cat.gems}
                      lines={detailPreview.catBreakdown.lines}
                    />
                  </div>

                  <AppCard variant="panel" className="mt-3">
                    <p className="text-center text-[11px] font-bold ui-text-reward">
                      这一天的小奖励
                    </p>
                    <div className="mt-2 grid min-w-0 grid-cols-2 gap-2">
                      <div className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">
                            <AppRoleAvatar role="fish" size={14} /><AppRoleAvatar role="cat" size={14} />
                          </span>
                          <AppCurrencyChip currency="coin" value={selectedRecord.bonus} size="sm" />
                        </div>
                        <BonusHintText active={selectedRecord.bonus > 0} />
                      </div>
                      <div className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">
                            <AppGameIcon name="gem" size={14} /> 宝石
                          </span>
                          <AppCurrencyChip currency="gem" value={selectedRecord.coins} size="sm" />
                        </div>
                        <CoinHintText hint={detailPreview.coin.hint} />
                      </div>
                    </div>
                  </AppCard>

                </div>
              ) : null}

              {detailMode === "edit" && editPreview ? (
                <div className="growth-log-detail-stack">
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                    <EditSide
                      role="fish"
                      weight={fishW}
                      setWeight={setFishW}
                      deficit={fishD}
                      setDeficit={setFishD}
                      minutes={fishM}
                      setMinutes={setFishM}
                    />
                    <EditSide
                      role="cat"
                      weight={catW}
                      setWeight={setCatW}
                      deficit={catD}
                      setDeficit={setCatD}
                      minutes={catM}
                      setMinutes={setCatM}
                    />
                  </div>

                  <AppCard variant="panel">
                    <p className="text-center text-[11px] font-bold ui-text-reward">
                      修改后的小奖励
                    </p>
                    <ul className="mt-2 grid min-w-0 grid-cols-2 gap-2 text-xs font-semibold ui-text-main">
                      <li className="growth-detail-extra-card">
                        <span className="flex items-center justify-between gap-2">
                          <AppRoleAvatar role="fish" size={14} />
                          <AppCurrencyChip currency="coin" value={editPreview.fishBreakdown.total} size="sm" />
                        </span>
                        <GemBreakdownText lines={editPreview.fishBreakdown.lines} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <span className="flex items-center justify-between gap-2">
                          <AppRoleAvatar role="cat" size={14} />
                          <AppCurrencyChip currency="coin" value={editPreview.catBreakdown.total} size="sm" />
                        </span>
                        <GemBreakdownText lines={editPreview.catBreakdown.lines} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">
                            <AppRoleAvatar role="fish" size={14} /><AppRoleAvatar role="cat" size={14} />
                          </span>
                          <AppCurrencyChip currency="coin" value={editPreview.couple.gems} size="sm" />
                        </div>
                        <BonusHintText active={editPreview.couple.gems > 0} />
                      </li>
                      <li className="growth-detail-extra-card">
                        <div className="growth-detail-extra-row">
                          <span className="growth-detail-extra-title">
                            <AppGameIcon name="gem" size={14} /> 宝石
                          </span>
                          <AppCurrencyChip currency="gem" value={editPreview.coin.delta} size="sm" />
                        </div>
                        <CoinHintText hint={editPreview.coin.hint} />
                      </li>
                    </ul>
                  </AppCard>

                </div>
              ) : null}
            </div>
        ) : null}
      </AppModal>

      <AppModal
        open={confirmDeleteOpen && Boolean(selectedRecord)}
        onClose={() => setConfirmDeleteOpen(false)}
        maskClosable
        width="min(92vw, 24rem)"
        title={<span id={confirmTitleId}>要删除这一天吗？</span>}
        footer={
          <div className="app-dialog-footer">
            <AppButton
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
              className="is-secondary flex-1 py-3 text-sm font-semibold"
            >
              取消
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              onClick={onConfirmDelete}
              className="flex-1 py-3 text-sm font-semibold"
            >
              确认删除
            </AppButton>
          </div>
        }
      >
            <p className="mt-2 text-xs leading-relaxed ui-text-muted">
              删掉就找不回这条啦。
            </p>
      </AppModal>

      {toast ? (
        <AppToast
          role="status"
          className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[80] w-[min(92vw,20rem)] -translate-x-1/2 px-4 py-3 text-center text-xs font-semibold ui-text-main"
        >
          {toast}
        </AppToast>
      ) : null}
    </>
  );
}

