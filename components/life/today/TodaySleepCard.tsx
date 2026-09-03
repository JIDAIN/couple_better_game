"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { saveSleep } from "@/lib/life/life-client";
import type { LifeDayRecord, LifePartnerKey, SleepRecord } from "@/lib/life/life-service";
import { buildSleepTimestamps, durationText, formatTime, timeInputValue } from "./today-life-model";

const FULL_SLEEP_MINUTES = 8 * 60;

function sleepProgress(record?: SleepRecord) {
  if (!record) return 0;
  const minutes = Math.max(0, (new Date(record.wokeAt).getTime() - new Date(record.fellAsleepAt).getTime()) / 60_000);
  return Math.min(1, minutes / FULL_SLEEP_MINUTES);
}

export function TodaySleepCard({
  date,
  day,
  onChanged,
  onError,
  readOnly = false,
}: {
  date: string;
  day: LifeDayRecord;
  onChanged?: () => Promise<void>;
  onError?: (message: string) => void;
  readOnly?: boolean;
}) {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const sleepByRole = useMemo(() => {
    const map = new Map<LifePartnerKey, SleepRecord>();
    day.sleeps.forEach((item) => map.set(item.partnerKey, item));
    return map;
  }, [day.sleeps]);

  async function saveMine() {
    if (!mePartnerKey || readOnly) return;
    const form = document.getElementById("life-sleep-form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    const sleepAt = String(data.get("self-sleep") ?? "");
    const wakeAt = String(data.get("self-wake") ?? "");
    if (!sleepAt || !wakeAt) return;
    setSaving(true);
    try {
      await saveSleep({ partnerKey: mePartnerKey, sleepDate: date, ...buildSleepTimestamps(date, sleepAt, wakeAt) });
      setEditing(false);
      if (onChanged) await onChanged();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "保存睡眠失败");
    } finally {
      setSaving(false);
    }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section>;
  }

  const mySleep = sleepByRole.get(mePartnerKey);

  return (
    <section className="life-surface life-section-card life-today-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">🌙 睡眠</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">8 小时为满环，时长一眼就能看见。</p>
        </div>
        {!readOnly ? (
          <AppButton variant="ghost" className="life-home-action-pill" onClick={() => setEditing((value) => !value)}>
            {editing ? "收起" : mySleep ? "编辑" : "+ 记录"}
          </AppButton>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SleepBubble label="我" record={mySleep} tone="var(--life-blue)" />
        <SleepBubble label="Ta" record={sleepByRole.get(taPartnerKey)} tone="var(--life-teal)" />
      </div>

      {!readOnly && editing ? (
        <form id="life-sleep-form" className="mt-4 grid gap-3 border-t border-[var(--life-border-soft)] pt-4" onSubmit={(event) => event.preventDefault()}>
          <SleepEditor label="我" prefix="self" record={mySleep} />
          <AppButton variant="primary" disabled={saving} onClick={() => void saveMine()}>{saving ? "保存中…" : "保存睡眠"}</AppButton>
        </form>
      ) : null}
    </section>
  );
}

function SleepBubble({ label, record, tone }: { label: string; record?: SleepRecord; tone: string }) {
  const progress = sleepProgress(record);
  const angle = Math.round(progress * 360);
  return (
    <div className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface)] p-3 text-center">
      <div
        className="life-sleep-progress-ring mx-auto grid h-20 w-20 place-items-center rounded-full p-[7px]"
        style={{ background: `conic-gradient(${tone} 0deg ${angle}deg, var(--life-border-soft) ${angle}deg 360deg)` }}
        aria-label={`${label}睡眠进度 ${Math.round(progress * 100)}%`}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-[var(--life-surface)] px-1">
          <strong className="text-sm text-[var(--life-text)]">{durationText(record)}</strong>
        </div>
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--life-text-muted)]">{label}</p>
      <p className="mt-0.5 text-[11px] text-[var(--life-text-body)]">{record ? `${formatTime(record.fellAsleepAt)} → ${formatTime(record.wokeAt)}` : "等待记录"}</p>
    </div>
  );
}

function SleepEditor({ label, prefix, record }: { label: string; prefix: string; record?: SleepRecord }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto_1fr] items-center gap-2 rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] p-3">
      <strong className="text-xs text-[var(--life-text)]">{label}</strong>
      <label className="grid gap-1 text-[10px] text-[var(--life-text-muted)]"><span>🌙 入睡</span><AppInput name={`${prefix}-sleep`} type="time" defaultValue={timeInputValue(record?.fellAsleepAt)} /></label>
      <span className="pt-4 text-[var(--life-text-muted)]">→</span>
      <label className="grid gap-1 text-[10px] text-[var(--life-text-muted)]"><span>☀️ 起床</span><AppInput name={`${prefix}-wake`} type="time" defaultValue={timeInputValue(record?.wokeAt)} /></label>
    </div>
  );
}
