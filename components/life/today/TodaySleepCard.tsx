"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { saveSleep } from "@/lib/life/life-client";
import type { LifeDayRecord, LifePartnerKey, SleepRecord } from "@/lib/life/life-service";
import { buildSleepTimestamps, durationText, formatTime, timeInputValue } from "./today-life-model";

export function TodaySleepCard({
  date,
  day,
  onChanged,
  onError,
}: {
  date: string;
  day: LifeDayRecord;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
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
    if (!mePartnerKey) return;
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
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存睡眠失败");
    } finally {
      setSaving(false);
    }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section>;
  }

  return (
    <section className="life-surface life-section-card life-today-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">🌙 睡眠</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">只记录入睡和起床。</p>
        </div>
        <AppButton variant="ghost" onClick={() => setEditing((value) => !value)}>
          {editing ? "收起" : sleepByRole.has(mePartnerKey) ? "修改" : "+ 记录"}
        </AppButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SleepBubble label="我" record={sleepByRole.get(mePartnerKey)} tone="var(--life-blue)" />
        <SleepBubble label="Ta" record={sleepByRole.get(taPartnerKey)} tone="var(--life-teal)" />
      </div>

      {editing ? (
        <form id="life-sleep-form" className="mt-4 grid gap-3 border-t border-[var(--life-border-soft)] pt-4" onSubmit={(event) => event.preventDefault()}>
          <SleepEditor label="我" prefix="self" record={sleepByRole.get(mePartnerKey)} />
          <AppButton variant="primary" disabled={saving} onClick={() => void saveMine()}>{saving ? "保存中…" : "保存睡眠"}</AppButton>
        </form>
      ) : null}
    </section>
  );
}

function SleepBubble({ label, record, tone }: { label: string; record?: SleepRecord; tone: string }) {
  return (
    <div className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface)] p-3 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border-[7px] bg-[var(--life-surface)]" style={{ borderColor: tone }}>
        <strong className="text-sm text-[var(--life-text)]">{durationText(record)}</strong>
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
