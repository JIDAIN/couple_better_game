"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppFeatureTile } from "@/components/ui/AppFeatureTile";
import { AppInput } from "@/components/ui/AppInput";
import { AppNutritionBar } from "@/components/ui/AppNutritionBar";
import { AppRecordRow } from "@/components/ui/AppRecordRow";
import { AppRoleSwitch, type AppRoleSwitchValue } from "@/components/ui/AppRoleSwitch";

const moods = [
  { key: "happy", emoji: "😄", label: "开心" },
  { key: "calm", emoji: "🙂", label: "平静" },
  { key: "neutral", emoji: "😐", label: "一般" },
  { key: "anxious", emoji: "😣", label: "焦虑" },
  { key: "sad", emoji: "😢", label: "难过" },
  { key: "angry", emoji: "😡", label: "生气" },
  { key: "tired", emoji: "😴", label: "疲惫" },
] as const;

export function RoleSwitchPreview() {
  const [value, setValue] = useState<AppRoleSwitchValue>("me");
  return <AppRoleSwitch value={value} onChange={setValue} />;
}

export function MoodPickerPreview() {
  const [fishMood, setFishMood] = useState<(typeof moods)[number]["key"]>("happy");
  const [catMood, setCatMood] = useState<(typeof moods)[number]["key"]>("calm");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MoodRoleRow label="我" value={fishMood} onChange={setFishMood} />
      <MoodRoleRow label="Ta" value={catMood} onChange={setCatMood} />
    </div>
  );
}

function MoodRoleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: (typeof moods)[number]["key"];
  onChange: (value: (typeof moods)[number]["key"]) => void;
}) {
  return (
    <section className="life-surface life-section-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <strong className="text-sm text-[var(--life-text)]">{label}</strong>
          <p className="mt-0.5 text-xs text-[var(--life-text-body)]">今天感觉怎么样？</p>
        </div>
        <span className="text-2xl" aria-hidden>{moods.find((mood) => mood.key === value)?.emoji}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={`${label}今日心情`}>
        {moods.map((mood) => (
          <button
            key={mood.key}
            type="button"
            role="radio"
            aria-checked={mood.key === value}
            aria-label={mood.label}
            className="life-mood-chip"
            onClick={() => onChange(mood.key)}
          >
            <span className="text-lg" aria-hidden>{mood.emoji}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function SleepRecordPreview() {
  const [sleepAt, setSleepAt] = useState("23:35");
  const [wakeAt, setWakeAt] = useState("07:45");
  const duration = useMemo(() => getSleepDuration(sleepAt, wakeAt), [sleepAt, wakeAt]);

  return (
    <section className="life-surface life-section-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <strong className="text-sm text-[var(--life-text)]">🌙 睡眠</strong>
          <p className="mt-0.5 text-xs text-[var(--life-text-body)]">只记录入睡和起床时间</p>
        </div>
        <AppButton variant="ghost">记录</AppButton>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="grid gap-1 text-xs text-[var(--life-text-body)]">
          <span>入睡</span>
          <AppInput type="time" value={sleepAt} onChange={(event) => setSleepAt(event.target.value)} />
        </label>
        <span className="pb-3 text-[var(--life-text-muted)]">→</span>
        <label className="grid gap-1 text-xs text-[var(--life-text-body)]">
          <span>起床</span>
          <AppInput type="time" value={wakeAt} onChange={(event) => setWakeAt(event.target.value)} />
        </label>
      </div>
      <p className="mt-3 rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-center text-sm text-[var(--life-text-body)]">
        {duration ? `约 ${duration}` : "选择时间后自动计算"}
      </p>
    </section>
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
  const [items, setItems] = useState(["一起散步 35 分钟", "晚上一起看资料分析"]);

  function addItem() {
    const value = draft.trim();
    if (!value) return;
    setItems((current) => [...current, value]);
    setDraft("");
  }

  return (
    <section className="life-surface life-section-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <strong className="text-sm text-[var(--life-text)]">👟 活动</strong>
          <p className="mt-0.5 text-xs text-[var(--life-text-body)]">学习、散步、运动和游玩都统一记在这里</p>
        </div>
        <AppButton variant="ghost" onClick={addItem}>记录</AppButton>
      </div>
      <div>
        {items.map((item, index) => (
          <AppRecordRow key={`${item}-${index}`} icon="🌱" title={item} />
        ))}
      </div>
      <div className="mt-3">
        <AppInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="记录一件今天做过的事…"
          onKeyDown={(event) => {
            if (event.key === "Enter") addItem();
          }}
        />
      </div>
    </section>
  );
}

export function NutritionPreview() {
  return (
    <section className="life-surface life-section-card grid gap-2.5">
      <AppNutritionBar label="碳水" value={62} unit="g" percent={64} tone="coral" />
      <AppNutritionBar label="蛋白质" value={18} unit="g" percent={52} tone="teal" />
      <AppNutritionBar label="脂肪" value={14} unit="g" percent={38} tone="yellow" />
      <AppNutritionBar label="总热量" value={456} unit="kcal" percent={58} tone="blue" />
    </section>
  );
}

export function FeatureTilesPreview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AppFeatureTile icon="⚖️" title="体重" description="我 / Ta 切换、趋势和最近记录" />
      <AppFeatureTile icon="💌" title="小信箱" description="纸张式信件卡片，不用头像列表" />
      <AppFeatureTile icon="💊" title="家庭药箱" description="库存、位置和保质期" />
      <AppFeatureTile icon="🎮" title="游戏机" description="游戏列表入口；当前只有宝石金币游戏" />
    </div>
  );
}
