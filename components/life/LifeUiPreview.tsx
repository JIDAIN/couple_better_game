"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppIcon } from "@/components/ui/AppIcon";
import { AppInput } from "@/components/ui/AppInput";
import { AppRoleAvatar } from "@/components/ui/AppRoleAvatar";

const moods = [
  { key: "happy", emoji: "😄", label: "开心" },
  { key: "calm", emoji: "🙂", label: "平静" },
  { key: "neutral", emoji: "😐", label: "一般" },
  { key: "anxious", emoji: "😣", label: "焦虑" },
  { key: "sad", emoji: "😢", label: "难过" },
  { key: "angry", emoji: "😡", label: "生气" },
  { key: "tired", emoji: "😴", label: "疲惫" },
] as const;

export function MoodPickerPreview() {
  const [fishMood, setFishMood] = useState<(typeof moods)[number]["key"]>("calm");
  const [catMood, setCatMood] = useState<(typeof moods)[number]["key"]>("neutral");

  return (
    <div className="grid gap-4">
      <MoodRoleRow role="fish" value={fishMood} onChange={setFishMood} />
      <MoodRoleRow role="cat" value={catMood} onChange={setCatMood} />
    </div>
  );
}

function MoodRoleRow({
  role,
  value,
  onChange,
}: {
  role: "fish" | "cat";
  value: (typeof moods)[number]["key"];
  onChange: (value: (typeof moods)[number]["key"]) => void;
}) {
  return (
    <AppCard variant="soft" className="!p-3">
      <div className="mb-3 flex items-center gap-2">
        <AppRoleAvatar role={role} size={30} />
        <div>
          <p className="font-semibold text-[var(--text-main)]">{role === "fish" ? "鱼鱼" : "猫猫"}</p>
          <p className="text-xs text-[var(--text-muted)]">今天感觉怎么样？</p>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={`${role} 今日心情`}>
        {moods.map((mood) => {
          const selected = mood.key === value;
          return (
            <button
              key={mood.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={mood.label}
              onClick={() => onChange(mood.key)}
              className={`flex min-h-14 flex-col items-center justify-center rounded-[var(--radius-control)] border px-1 py-2 transition duration-150 active:translate-y-0.5 ${
                selected
                  ? "border-[var(--animal-accent)] bg-[var(--animal-accent-soft)] shadow-[var(--shadow-soft)]"
                  : "border-[var(--card-border-soft)] bg-[var(--card-bg-strong)] hover:bg-[var(--bg-soft)]"
              }`}
            >
              <span className={`text-xl transition-transform ${selected ? "scale-110" : ""}`} aria-hidden>
                {mood.emoji}
              </span>
              <span className="mt-1 hidden text-[10px] text-[var(--text-body)] sm:block">{mood.label}</span>
            </button>
          );
        })}
      </div>
    </AppCard>
  );
}

export function SleepRecordPreview() {
  const [sleepAt, setSleepAt] = useState("00:35");
  const [wakeAt, setWakeAt] = useState("08:10");
  const duration = useMemo(() => getSleepDuration(sleepAt, wakeAt), [sleepAt, wakeAt]);

  return (
    <AppCard variant="soft" className="!p-4">
      <div className="mb-3 flex items-center gap-2 text-[var(--text-main)]">
        <span aria-hidden>🌙</span>
        <strong>睡眠</strong>
        <span className="ml-auto text-xs text-[var(--text-muted)]">只记入睡和起床</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="grid gap-1.5 text-xs text-[var(--text-body)]">
          <span>🌙 入睡</span>
          <AppInput type="time" value={sleepAt} onChange={(event) => setSleepAt(event.target.value)} />
        </label>
        <span className="pb-3 text-lg text-[var(--text-placeholder)]" aria-hidden>
          →
        </span>
        <label className="grid gap-1.5 text-xs text-[var(--text-body)]">
          <span>☀️ 起床</span>
          <AppInput type="time" value={wakeAt} onChange={(event) => setWakeAt(event.target.value)} />
        </label>
      </div>
      <p className="mt-3 rounded-full bg-[var(--bg-warm)] px-3 py-2 text-center text-sm text-[var(--text-body)]">
        {duration ? `约 ${duration}` : "选择时间后自动计算时长"}
      </p>
    </AppCard>
  );
}

function getSleepDuration(sleepAt: string, wakeAt: string) {
  if (!sleepAt || !wakeAt) return "";
  const [sleepHour, sleepMinute] = sleepAt.split(":").map(Number);
  const [wakeHour, wakeMinute] = wakeAt.split(":").map(Number);
  let minutes = wakeHour * 60 + wakeMinute - (sleepHour * 60 + sleepMinute);
  if (minutes <= 0) minutes += 24 * 60;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}小时${rest ? `${rest}分` : ""}`;
}

export function ActivityNotePreview() {
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState(["一起看资料分析视频", "晚饭后散步30分钟"]);

  function addItem() {
    const value = draft.trim();
    if (!value) return;
    setItems((current) => [...current, value]);
    setDraft("");
  }

  return (
    <AppCard variant="soft" className="!p-4">
      <div className="mb-3 flex items-center gap-2 text-[var(--text-main)]">
        <AppIcon name="icon-design" size={18} />
        <strong>今天做了什么</strong>
      </div>
      <div className="grid gap-2">
        {items.map((item, index) => (
          <div
            key={`${item}-${index}`}
            className="flex items-start gap-2 rounded-[var(--radius-control)] border border-[var(--card-border-soft)] bg-[var(--card-bg-strong)] px-3 py-2.5 text-sm text-[var(--text-body)]"
          >
            <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[var(--animal-accent)]" aria-hidden />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <div className="min-w-0 flex-1">
          <AppInput
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="记录一件今天做过的事…"
            onKeyDown={(event) => {
              if (event.key === "Enter") addItem();
            }}
          />
        </div>
        <AppButton variant="primary" onClick={addItem}>
          添加
        </AppButton>
      </div>
    </AppCard>
  );
}

export function FeatureTilePreview({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--card-border-soft)] bg-[var(--card-bg-strong)] p-3 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 active:translate-y-0"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-[var(--animal-accent-soft)] text-xl" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm text-[var(--text-main)]">{title}</strong>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--text-muted)]">{description}</span>
      </span>
    </button>
  );
}
