"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppRecordRow } from "@/components/ui/AppRecordRow";
import { createActivityEntry, deleteActivityEntry } from "@/lib/life/life-client";
import type { LifeDayRecord } from "@/lib/life/life-service";

export function TodayActivityCard({
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  async function add() {
    const text = draft.trim();
    if (!text) return;
    setSaving("new");
    try {
      await createActivityEntry({
        activityDate: date,
        text,
        participantScope: "both",
        occurredAt: new Date().toISOString(),
      });
      setDraft("");
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存活动失败");
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string) {
    setSaving(id);
    try {
      await deleteActivityEntry(id);
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "删除活动失败");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="life-surface life-section-card overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">👟 活动</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">学习、散步、约会、桌游，都只是今天做过的事。</p>
        </div>
        <AppButton variant="ghost" onClick={() => setEditing((value) => !value)}>{editing ? "完成" : "+ 记录"}</AppButton>
      </div>

      <div className="mb-3 flex min-h-20 items-end justify-between rounded-[var(--life-radius-control)] bg-[linear-gradient(180deg,var(--life-surface-soft),color-mix(in_srgb,var(--life-mint)_25%,white))] px-4 pt-3">
        <div className="pb-3 text-xs leading-5 text-[var(--life-text-body)]">
          <strong className="block text-sm text-[var(--life-text)]">今天一起做了什么？</strong>
          <span>以后这里会替换成你们自己的动森角色。</span>
        </div>
        <div className="pb-1 text-4xl" aria-label="两位女孩的临时岛民形象">👧🏻🌿👧🏻</div>
      </div>

      <div className="grid gap-2">
        {day.activities.length ? day.activities.map((activity) => (
          <AppRecordRow
            key={activity.id}
            icon="🌱"
            title={activity.text}
            description={activity.durationMinutes ? `${activity.durationMinutes} 分钟` : undefined}
            trailing={<button type="button" aria-label={`删除 ${activity.text}`} disabled={saving === activity.id} onClick={() => void remove(activity.id)} className="rounded-full px-2 py-1 text-xs text-[var(--life-text-muted)] hover:bg-[var(--life-surface-soft)] hover:text-[var(--life-danger)]">×</button>}
          />
        )) : <p className="rounded-[var(--life-radius-control)] border border-dashed border-[var(--life-border)] px-3 py-4 text-center text-sm text-[var(--life-text-muted)]">今天还没有活动记录。</p>}
      </div>

      {editing ? (
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1"><AppInput value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="例如：晚饭后一起散步30分钟" onKeyDown={(event) => { if (event.key === "Enter") void add(); }} /></div>
          <AppButton variant="primary" disabled={saving === "new" || !draft.trim()} onClick={() => void add()}>添加</AppButton>
        </div>
      ) : null}
    </section>
  );
}
