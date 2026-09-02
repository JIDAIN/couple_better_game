"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppRecordRow } from "@/components/ui/AppRecordRow";
import {
  createActivityEntry,
  deleteActivityEntry,
  fetchLifeDay,
  LifeApiError,
  saveMood,
  saveSleep,
} from "@/lib/life/life-client";
import type {
  LifeDayRecord,
  LifePartnerKey,
  MoodKey,
  SleepRecord,
} from "@/lib/life/life-service";

const SELF_KEY: LifePartnerKey = "cat";
const TA_KEY: LifePartnerKey = "fish";

const moods: Array<{ key: MoodKey; emoji: string; label: string; tone: string }> = [
  { key: "happy", emoji: "☺", label: "开心", tone: "bg-[var(--life-pink)]" },
  { key: "calm", emoji: "•ᴗ•", label: "平静", tone: "bg-[var(--life-mint)]" },
  { key: "neutral", emoji: "•‿•", label: "一般", tone: "bg-[var(--life-yellow)]" },
  { key: "anxious", emoji: "•﹏•", label: "焦虑", tone: "bg-[var(--life-blue)]" },
  { key: "sad", emoji: "｡•́︿•̀｡", label: "难过", tone: "bg-[var(--life-pink)]" },
  { key: "angry", emoji: "•̀⤙•́", label: "生气", tone: "bg-[var(--life-coral)]" },
  { key: "tired", emoji: "- ᴗ -", label: "疲惫", tone: "bg-[var(--life-blue)]" },
];

function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function displayDate(date: string) {
  const value = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
}

function moodVisual(key?: MoodKey) {
  return moods.find((item) => item.key === key) ?? null;
}

function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function durationText(record?: SleepRecord) {
  if (!record) return "未记录";
  const minutes = Math.max(
    0,
    Math.round((new Date(record.wokeAt).getTime() - new Date(record.fellAsleepAt).getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}.${Math.round((rest / 60) * 10)} 小时`;
}

function timeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildSleepTimestamps(date: string, sleepAt: string, wakeAt: string) {
  const sleep = new Date(`${date}T${sleepAt}:00`);
  const wake = new Date(`${date}T${wakeAt}:00`);
  if (wake.getTime() <= sleep.getTime()) wake.setDate(wake.getDate() + 1);
  return { fellAsleepAt: sleep.toISOString(), wokeAt: wake.toISOString() };
}

export function TodayLifePage() {
  const [date] = useState(() => localIsoDate());
  const [day, setDay] = useState<LifeDayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [moodEditing, setMoodEditing] = useState(false);
  const [sleepEditing, setSleepEditing] = useState(false);
  const [activityEditing, setActivityEditing] = useState(false);
  const [activityDraft, setActivityDraft] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const loadDay = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchLifeDay(date);
      setDay(next);
      setNeedsLogin(false);
    } catch (cause) {
      if (cause instanceof LifeApiError && cause.status === 401) {
        setNeedsLogin(true);
        setDay(null);
      } else {
        setError(cause instanceof Error ? cause.message : "读取今天的生活记录失败");
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const moodByRole = useMemo(() => {
    const map = new Map<LifePartnerKey, MoodKey>();
    day?.moods.forEach((item) => map.set(item.partnerKey, item.moodKey));
    return map;
  }, [day]);

  const sleepByRole = useMemo(() => {
    const map = new Map<LifePartnerKey, SleepRecord>();
    day?.sleeps.forEach((item) => map.set(item.partnerKey, item));
    return map;
  }, [day]);

  async function connectCloud() {
    const value = password.trim();
    if (!value) return;
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/cloud-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "连接云端失败");
      setPassword("");
      await loadDay();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接云端失败");
    } finally {
      setConnecting(false);
    }
  }

  async function chooseMood(partnerKey: LifePartnerKey, moodKey: MoodKey) {
    setSaving(`mood-${partnerKey}`);
    setError(null);
    try {
      await saveMood({ partnerKey, moodDate: date, moodKey });
      await loadDay();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存心情失败");
    } finally {
      setSaving(null);
    }
  }

  async function saveSleepPair() {
    const form = document.getElementById("life-sleep-form") as HTMLFormElement | null;
    if (!form) return;
    const data = new FormData(form);
    setSaving("sleep");
    setError(null);
    try {
      for (const [partnerKey, prefix] of [
        [SELF_KEY, "self"],
        [TA_KEY, "ta"],
      ] as const) {
        const sleepAt = String(data.get(`${prefix}-sleep`) ?? "");
        const wakeAt = String(data.get(`${prefix}-wake`) ?? "");
        if (!sleepAt || !wakeAt) continue;
        const timestamps = buildSleepTimestamps(date, sleepAt, wakeAt);
        await saveSleep({ partnerKey, sleepDate: date, ...timestamps });
      }
      setSleepEditing(false);
      await loadDay();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存睡眠失败");
    } finally {
      setSaving(null);
    }
  }

  async function addActivity() {
    const text = activityDraft.trim();
    if (!text) return;
    setSaving("activity");
    setError(null);
    try {
      await createActivityEntry({
        activityDate: date,
        text,
        participantScope: "both",
        occurredAt: new Date().toISOString(),
      });
      setActivityDraft("");
      await loadDay();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存活动失败");
    } finally {
      setSaving(null);
    }
  }

  async function removeActivity(id: string) {
    setSaving(`activity-${id}`);
    setError(null);
    try {
      await deleteActivityEntry(id);
      await loadDay();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除活动失败");
    } finally {
      setSaving(null);
    }
  }

  if (needsLogin) {
    return (
      <AppPageShell title="岛屿生活" subtitle="连接云端后，继续记录今天。">
        <section className="life-surface life-section-card mx-auto mt-8 max-w-md">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-[var(--life-mint)] text-3xl">🏝️</div>
            <h2 className="text-lg font-extrabold text-[var(--life-text)]">回到我们的小岛</h2>
            <p className="mt-1 text-sm text-[var(--life-text-body)]">输入原来的同步密码即可继续。</p>
          </div>
          <div className="grid gap-3">
            <AppInput
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="同步密码"
              onKeyDown={(event) => {
                if (event.key === "Enter") void connectCloud();
              }}
            />
            <AppButton variant="primary" disabled={connecting || !password.trim()} onClick={() => void connectCloud()}>
              {connecting ? "连接中…" : "连接云端"}
            </AppButton>
            {error ? <p className="text-center text-sm text-[var(--life-danger)]">{error}</p> : null}
          </div>
        </section>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell title={displayDate(date)} subtitle="只记重要的小日常，照顾好彼此。">
      {error ? (
        <div className="mb-3 rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_18%,white)] px-3 py-2 text-sm text-[var(--life-danger)]">
          {error}
        </div>
      ) : null}

      {loading && !day ? (
        <div className="life-surface life-section-card text-center text-sm text-[var(--life-text-muted)]">正在看看今天留下了什么…</div>
      ) : (
        <div className="grid gap-3">
          <section className="life-surface life-section-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--life-text)]">🍃 心情</p>
                <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">点一下就记好，不需要解释。</p>
              </div>
              <AppButton variant="ghost" onClick={() => setMoodEditing((value) => !value)}>
                {moodEditing ? "完成" : day?.moods.length ? "修改" : "+ 记录"}
              </AppButton>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MoodFace label="我" moodKey={moodByRole.get(SELF_KEY)} />
              <MoodFace label="Ta" moodKey={moodByRole.get(TA_KEY)} />
            </div>

            {moodEditing ? (
              <div className="mt-4 grid gap-3 border-t border-[var(--life-border-soft)] pt-4">
                <MoodEditor
                  label="我"
                  value={moodByRole.get(SELF_KEY)}
                  disabled={saving === `mood-${SELF_KEY}`}
                  onChange={(key) => void chooseMood(SELF_KEY, key)}
                />
                <MoodEditor
                  label="Ta"
                  value={moodByRole.get(TA_KEY)}
                  disabled={saving === `mood-${TA_KEY}`}
                  onChange={(key) => void chooseMood(TA_KEY, key)}
                />
              </div>
            ) : null}
          </section>

          <section className="life-surface life-section-card">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--life-text)]">🌙 睡眠</p>
                <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">只记录入睡和起床时间。</p>
              </div>
              <AppButton variant="ghost" onClick={() => setSleepEditing((value) => !value)}>
                {sleepEditing ? "收起" : day?.sleeps.length ? "修改" : "+ 记录"}
              </AppButton>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SleepBubble label="我" record={sleepByRole.get(SELF_KEY)} tone="var(--life-blue)" />
              <SleepBubble label="Ta" record={sleepByRole.get(TA_KEY)} tone="var(--life-teal)" />
            </div>

            {sleepEditing ? (
              <form id="life-sleep-form" className="mt-4 grid gap-3 border-t border-[var(--life-border-soft)] pt-4" onSubmit={(event) => event.preventDefault()}>
                <SleepEditor label="我" prefix="self" record={sleepByRole.get(SELF_KEY)} />
                <SleepEditor label="Ta" prefix="ta" record={sleepByRole.get(TA_KEY)} />
                <AppButton variant="primary" disabled={saving === "sleep"} onClick={() => void saveSleepPair()}>
                  {saving === "sleep" ? "保存中…" : "保存睡眠"}
                </AppButton>
              </form>
            ) : null}
          </section>

          <section className="life-surface life-section-card overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--life-text)]">👟 活动</p>
                <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">学习、散步、约会、桌游，都只是今天做过的事。</p>
              </div>
              <AppButton variant="ghost" onClick={() => setActivityEditing((value) => !value)}>
                {activityEditing ? "完成" : "+ 记录"}
              </AppButton>
            </div>

            <div className="mb-3 flex min-h-20 items-end justify-between rounded-[var(--life-radius-control)] bg-[linear-gradient(180deg,var(--life-surface-soft),color-mix(in_srgb,var(--life-mint)_25%,white))] px-4 pt-3">
              <div className="pb-3 text-xs leading-5 text-[var(--life-text-body)]">
                <strong className="block text-sm text-[var(--life-text)]">今天一起做了什么？</strong>
                <span>以后这里会替换成你们自己的动森角色。</span>
              </div>
              <div className="pb-1 text-4xl" aria-label="两位女孩的临时岛民形象">👧🏻🌿👧🏻</div>
            </div>

            <div className="grid gap-2">
              {day?.activities.length ? (
                day.activities.map((activity) => (
                  <AppRecordRow
                    key={activity.id}
                    icon="🌱"
                    title={activity.text}
                    description={activity.durationMinutes ? `${activity.durationMinutes} 分钟` : undefined}
                    trailing={
                      <button
                        type="button"
                        aria-label={`删除 ${activity.text}`}
                        disabled={saving === `activity-${activity.id}`}
                        onClick={() => void removeActivity(activity.id)}
                        className="rounded-full px-2 py-1 text-xs text-[var(--life-text-muted)] hover:bg-[var(--life-surface-soft)] hover:text-[var(--life-danger)]"
                      >
                        ×
                      </button>
                    }
                  />
                ))
              ) : (
                <p className="rounded-[var(--life-radius-control)] border border-dashed border-[var(--life-border)] px-3 py-4 text-center text-sm text-[var(--life-text-muted)]">今天还没有活动记录。</p>
              )}
            </div>

            {activityEditing ? (
              <div className="mt-3 flex gap-2">
                <div className="min-w-0 flex-1">
                  <AppInput
                    value={activityDraft}
                    onChange={(event) => setActivityDraft(event.target.value)}
                    placeholder="例如：晚饭后一起散步30分钟"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void addActivity();
                    }}
                  />
                </div>
                <AppButton variant="primary" disabled={saving === "activity" || !activityDraft.trim()} onClick={() => void addActivity()}>
                  添加
                </AppButton>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </AppPageShell>
  );
}

function MoodFace({ label, moodKey }: { label: string; moodKey?: MoodKey }) {
  const visual = moodVisual(moodKey);
  return (
    <div className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface)] p-3 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-lg font-black text-[var(--life-text)] ${visual?.tone ?? "bg-[var(--life-surface-soft)]"}`}>
        {visual?.emoji ?? "+"}
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--life-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-[var(--life-text)]">{visual?.label ?? "未记录"}</p>
    </div>
  );
}

function MoodEditor({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value?: MoodKey;
  disabled: boolean;
  onChange: (key: MoodKey) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[var(--life-text-body)]">{label}</p>
      <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={`${label} 心情`}>
        {moods.map((mood) => (
          <button
            key={mood.key}
            type="button"
            role="radio"
            aria-checked={mood.key === value}
            aria-label={mood.label}
            disabled={disabled}
            onClick={() => onChange(mood.key)}
            className={`life-mood-chip px-1 ${mood.key === value ? "ring-2 ring-[var(--life-teal)] ring-offset-1" : ""}`}
          >
            <span className={`grid h-8 w-8 place-items-center rounded-full text-[10px] font-black ${mood.tone}`}>{mood.emoji}</span>
            <span className="hidden text-[9px] sm:block">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SleepBubble({ label, record, tone }: { label: string; record?: SleepRecord; tone: string }) {
  return (
    <div className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface)] p-3 text-center">
      <div
        className="mx-auto grid h-20 w-20 place-items-center rounded-full border-[7px] bg-[var(--life-surface)]"
        style={{ borderColor: tone }}
      >
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
      <label className="grid gap-1 text-[10px] text-[var(--life-text-muted)]">
        <span>🌙 入睡</span>
        <AppInput name={`${prefix}-sleep`} type="time" defaultValue={timeInputValue(record?.fellAsleepAt)} />
      </label>
      <span className="pt-4 text-[var(--life-text-muted)]">→</span>
      <label className="grid gap-1 text-[10px] text-[var(--life-text-muted)]">
        <span>☀️ 起床</span>
        <AppInput name={`${prefix}-wake`} type="time" defaultValue={timeInputValue(record?.wokeAt)} />
      </label>
    </div>
  );
}
