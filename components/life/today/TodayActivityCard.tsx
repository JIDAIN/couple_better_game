"use client";

import Image from "next/image";
import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppRecordRow } from "@/components/ui/AppRecordRow";
import { createActivityEntry, deleteActivityEntry, updateActivityEntry } from "@/lib/life/life-client";
import type { ActivityRecord, LifeDayRecord } from "@/lib/life/life-service";

const ACTIVITY_TYPES = [
  { key: "walk", icon: "🚶‍♀️", label: "散步" },
  { key: "study", icon: "📚", label: "学习" },
  { key: "exercise", icon: "🏃‍♀️", label: "运动" },
  { key: "date", icon: "💗", label: "约会" },
  { key: "movie", icon: "🎬", label: "电影" },
  { key: "boardgame", icon: "🎲", label: "桌游" },
  { key: "travel", icon: "🧳", label: "旅行" },
  { key: "cooking", icon: "🍳", label: "做饭" },
  { key: "shopping", icon: "🛍️", label: "购物" },
  { key: "chores", icon: "🧹", label: "家务" },
  { key: "other", icon: "🌱", label: "其他" },
] as const;

type ActivityTypeKey = (typeof ACTIVITY_TYPES)[number]["key"];

function activityVisual(type: string | null | undefined) {
  return ACTIVITY_TYPES.find((item) => item.key === type) ?? ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
}

export function TodayActivityCard({
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
  const [addOpen, setAddOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftType, setDraftType] = useState<ActivityTypeKey>("walk");
  const [saving, setSaving] = useState<string | null>(null);
  const [records, setRecords] = useState<ActivityRecord[]>(() => day.activities);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<ActivityTypeKey>("other");

  async function add() {
    const text = draft.trim();
    if (!text || readOnly) return;
    setSaving("new");
    try {
      const saved = await createActivityEntry({
        activityDate: date,
        text,
        participantScope: "both",
        activityType: draftType,
        occurredAt: new Date().toISOString(),
      });
      setRecords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setDraft("");
      if (onChanged) void onChanged();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "保存活动失败");
    } finally {
      setSaving(null);
    }
  }

  function beginEdit(activity: ActivityRecord) {
    const visual = activityVisual(activity.activityType);
    setEditingId(activity.id);
    setEditText(activity.text);
    setEditType(visual.key);
  }

  async function saveEdit(activity: ActivityRecord) {
    const text = editText.trim();
    if (!text || readOnly) return;
    setSaving(activity.id);
    try {
      const saved = await updateActivityEntry(activity.id, {
        activityDate: activity.activityDate,
        occurredAt: activity.occurredAt,
        text,
        participantScope: activity.participantScope,
        activityType: editType,
        durationMinutes: activity.durationMinutes,
      });
      setRecords((current) => current.map((item) => item.id === saved.id ? saved : item));
      setEditingId(null);
      if (onChanged) void onChanged();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "修改活动失败");
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string) {
    if (readOnly) return;
    setSaving(id);
    try {
      await deleteActivityEntry(id);
      setRecords((current) => current.filter((item) => item.id !== id));
      if (editingId === id) setEditingId(null);
      if (onChanged) void onChanged();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "删除活动失败");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="life-surface life-section-card life-today-card overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">👟 活动</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">今天一起做过的事。</p>
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 gap-1.5">
            <AppButton variant="ghost" className="life-home-action-pill" onClick={() => setAddOpen((value) => !value)}>{addOpen ? "收起" : "+ 记录"}</AppButton>
            {records.length ? <AppButton variant="ghost" className="life-home-action-pill" onClick={() => { setEditMode((value) => !value); setEditingId(null); }}>{editMode ? "完成编辑" : "编辑"}</AppButton> : null}
          </div>
        ) : null}
      </div>

      <div className="life-activity-scene mb-3 flex min-h-20 items-end justify-between rounded-[var(--life-radius-control)] px-4 pt-3">
        <div className="pb-3 text-xs leading-5 text-[var(--life-text-body)]">
          <strong className="block text-sm text-[var(--life-text)]">今天一起做了什么？</strong>
          <span>普通的一天，也值得被记住。</span>
        </div>
        <Image src="/illustrations/life/activity-girls.png" alt="一起生活的两个女孩" width={360} height={240} className="life-activity-girls" />
      </div>

      {addOpen && !readOnly ? (
        <div className="life-activity-composer mb-3 grid gap-3 rounded-[var(--life-radius-control)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-3">
          <div className="flex gap-2 overflow-x-auto pb-1" aria-label="活动图标">
            {ACTIVITY_TYPES.map((item) => (
              <button key={item.key} type="button" onClick={() => setDraftType(item.key)} className={`life-activity-icon-choice ${draftType === item.key ? "is-active" : ""}`} title={item.label} aria-label={item.label}>
                <span aria-hidden>{item.icon}</span><small>{item.label}</small>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><AppInput value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="例如：晚饭后一起散步30分钟" onKeyDown={(event) => { if (event.key === "Enter") void add(); }} /></div>
            <AppButton variant="primary" disabled={saving === "new" || !draft.trim()} onClick={() => void add()}>添加</AppButton>
          </div>
          <p className="text-[10px] leading-4 text-[var(--life-text-muted)]">点“添加”后会立即出现在下面的列表，不需要再点一次“完成”。</p>
        </div>
      ) : null}

      <div className="grid gap-2">
        {records.length ? records.map((activity) => {
          const visual = activityVisual(activity.activityType);
          const editingThis = editingId === activity.id;
          return editingThis ? (
            <div key={activity.id} className="grid gap-2 rounded-[var(--life-radius-control)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-3">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {ACTIVITY_TYPES.map((item) => <button key={item.key} type="button" onClick={() => setEditType(item.key)} className={`life-activity-icon-choice is-compact ${editType === item.key ? "is-active" : ""}`} aria-label={item.label}><span>{item.icon}</span></button>)}
              </div>
              <AppInput value={editText} onChange={(event) => setEditText(event.target.value)} />
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingId(null)} className="life-inline-link">取消</button><button type="button" disabled={saving === activity.id || !editText.trim()} onClick={() => void saveEdit(activity)} className="life-inline-link is-strong">保存</button></div>
            </div>
          ) : (
            <AppRecordRow
              key={activity.id}
              icon={visual.icon}
              title={activity.text}
              description={[visual.label, activity.durationMinutes ? `${activity.durationMinutes} 分钟` : null].filter(Boolean).join(" · ")}
              trailing={!readOnly && editMode ? <div className="flex gap-1"><button type="button" aria-label={`编辑 ${activity.text}`} onClick={() => beginEdit(activity)} className="life-row-mini-action">编辑</button><button type="button" aria-label={`删除 ${activity.text}`} disabled={saving === activity.id} onClick={() => void remove(activity.id)} className="life-row-mini-action is-danger">删除</button></div> : undefined}
            />
          );
        }) : <p className="rounded-[var(--life-radius-control)] border border-dashed border-[var(--life-border)] px-3 py-4 text-center text-sm text-[var(--life-text-muted)]">今天还没有活动记录。</p>}
      </div>
    </section>
  );
}
