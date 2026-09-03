"use client";

import Image from "next/image";
import { useState } from "react";
import { AppInput } from "@/components/ui/AppInput";
import { AppRecordRow } from "@/components/ui/AppRecordRow";
import { createActivityEntry, deleteActivityEntry, updateActivityEntry } from "@/lib/life/life-client";
import type { ActivityRecord, LifeDayRecord } from "@/lib/life/life-service";

const ACTIVITY_ICONS = [
  { key: "other", icon: "🌱", label: "默认" },
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
  { key: "reading", icon: "📖", label: "阅读" },
  { key: "coffee", icon: "☕", label: "咖啡" },
  { key: "meal", icon: "🍜", label: "吃饭" },
  { key: "music", icon: "🎧", label: "音乐" },
  { key: "photo", icon: "📷", label: "拍照" },
  { key: "work", icon: "💻", label: "工作" },
  { key: "gym", icon: "🏋️", label: "健身" },
  { key: "run", icon: "🏃", label: "跑步" },
  { key: "bike", icon: "🚲", label: "骑行" },
  { key: "hike", icon: "🥾", label: "徒步" },
  { key: "swim", icon: "🏊", label: "游泳" },
  { key: "museum", icon: "🏛️", label: "展览" },
  { key: "concert", icon: "🎵", label: "演出" },
  { key: "gaming", icon: "🎮", label: "游戏" },
  { key: "pet", icon: "🐾", label: "宠物" },
  { key: "chat", icon: "💬", label: "聊天" },
  { key: "party", icon: "🎉", label: "聚会" },
  { key: "spa", icon: "🛁", label: "放松" },
  { key: "cleaning", icon: "🫧", label: "整理" },
] as const;

type ActivityIconKey = (typeof ACTIVITY_ICONS)[number]["key"];
type IconPickerTarget = "new" | string | null;

function activityVisual(type: string | null | undefined) {
  return ACTIVITY_ICONS.find((item) => item.key === type) ?? ACTIVITY_ICONS[0];
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
  const [draftType, setDraftType] = useState<ActivityIconKey>("other");
  const [saving, setSaving] = useState<string | null>(null);
  const [records, setRecords] = useState<ActivityRecord[]>(() => day.activities);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState<ActivityIconKey>("other");
  const [iconPickerTarget, setIconPickerTarget] = useState<IconPickerTarget>(null);

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
      setDraftType("other");
      setIconPickerTarget(null);
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
    setIconPickerTarget(null);
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
      setIconPickerTarget(null);
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
    <section className="life-surface life-section-card life-today-card overflow-visible">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">👟 活动</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">今天一起做过的事。</p>
        </div>
        {!readOnly ? (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" className="life-card-action" onClick={() => { setAddOpen((value) => !value); setIconPickerTarget(null); }}>
              {addOpen ? "收起" : "+ 记录"}
            </button>
            {records.length ? (
              <button type="button" className="life-card-action" onClick={() => { setEditMode((value) => !value); setEditingId(null); setIconPickerTarget(null); }}>
                {editMode ? "完成" : "编辑"}
              </button>
            ) : null}
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
        <div className="life-activity-composer mb-3 rounded-[var(--life-radius-control)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-3">
          <div className="life-activity-input-row flex items-center gap-2">
            <div className="relative shrink-0">
              <button
                type="button"
                className="life-activity-leading-icon"
                aria-label="选择活动图标"
                aria-expanded={iconPickerTarget === "new"}
                onClick={() => setIconPickerTarget((current) => current === "new" ? null : "new")}
              >
                <span aria-hidden>{activityVisual(draftType).icon}</span>
              </button>
              {iconPickerTarget === "new" ? (
                <ActivityIconPicker
                  value={draftType}
                  onChange={(value) => { setDraftType(value); setIconPickerTarget(null); }}
                  onClose={() => setIconPickerTarget(null)}
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <AppInput
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="记录一件一起做的事…"
                onKeyDown={(event) => { if (event.key === "Enter") void add(); }}
              />
            </div>
            <button type="button" className="life-activity-add-button" disabled={saving === "new" || !draft.trim()} onClick={() => void add()}>
              添加
            </button>
          </div>
          <p className="mt-2 pl-11 text-[10px] leading-4 text-[var(--life-text-muted)]">默认使用小叶子；点左侧图标可以像 Notion 一样换成更合适的活动图标。</p>
        </div>
      ) : null}

      <div className="grid gap-2">
        {records.length ? records.map((activity) => {
          const visual = activityVisual(activity.activityType);
          const editingThis = editingId === activity.id;
          return editingThis ? (
            <div key={activity.id} className="life-activity-edit-row rounded-[var(--life-radius-control)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-3">
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className="life-activity-leading-icon is-small"
                    aria-label="修改活动图标"
                    aria-expanded={iconPickerTarget === activity.id}
                    onClick={() => setIconPickerTarget((current) => current === activity.id ? null : activity.id)}
                  >
                    <span aria-hidden>{activityVisual(editType).icon}</span>
                  </button>
                  {iconPickerTarget === activity.id ? (
                    <ActivityIconPicker
                      value={editType}
                      onChange={(value) => { setEditType(value); setIconPickerTarget(null); }}
                      onClose={() => setIconPickerTarget(null)}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1"><AppInput value={editText} onChange={(event) => setEditText(event.target.value)} /></div>
              </div>
              <div className="mt-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setEditingId(null); setIconPickerTarget(null); }} className="life-inline-link">取消</button>
                <button type="button" disabled={saving === activity.id || !editText.trim()} onClick={() => void saveEdit(activity)} className="life-inline-link is-strong">保存</button>
              </div>
            </div>
          ) : (
            <AppRecordRow
              key={activity.id}
              icon={visual.icon}
              title={activity.text}
              description={activity.durationMinutes ? `${activity.durationMinutes} 分钟` : undefined}
              trailing={!readOnly && editMode ? <div className="flex gap-1"><button type="button" aria-label={`编辑 ${activity.text}`} onClick={() => beginEdit(activity)} className="life-row-mini-action">编辑</button><button type="button" aria-label={`删除 ${activity.text}`} disabled={saving === activity.id} onClick={() => void remove(activity.id)} className="life-row-mini-action is-danger">删除</button></div> : undefined}
            />
          );
        }) : <p className="rounded-[var(--life-radius-control)] border border-dashed border-[var(--life-border)] px-3 py-4 text-center text-sm text-[var(--life-text-muted)]">今天还没有活动记录。</p>}
      </div>
    </section>
  );
}

function ActivityIconPicker({
  value,
  onChange,
  onClose,
}: {
  value: ActivityIconKey;
  onChange: (value: ActivityIconKey) => void;
  onClose: () => void;
}) {
  return (
    <div className="life-activity-icon-popover" role="dialog" aria-label="选择活动图标">
      <div className="life-activity-icon-popover-head">
        <span>选择图标</span>
        <button type="button" onClick={onClose} aria-label="关闭图标选择">×</button>
      </div>
      <div className="life-activity-icon-grid">
        {ACTIVITY_ICONS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={value === item.key ? "is-current" : ""}
            title={item.label}
            aria-label={item.label}
            onClick={() => onChange(item.key)}
          >
            <span aria-hidden>{item.icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}