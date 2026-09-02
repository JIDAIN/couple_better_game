import type { LifePartnerKey, MoodKey, SleepRecord } from "@/lib/life/life-service";

export const SELF_KEY: LifePartnerKey = "cat";
export const TA_KEY: LifePartnerKey = "fish";

export const MOODS: Array<{ key: MoodKey; emoji: string; label: string; tone: string }> = [
  { key: "happy", emoji: "☺", label: "开心", tone: "bg-[var(--life-pink)]" },
  { key: "calm", emoji: "•ᴗ•", label: "平静", tone: "bg-[var(--life-mint)]" },
  { key: "neutral", emoji: "•‿•", label: "一般", tone: "bg-[var(--life-yellow)]" },
  { key: "anxious", emoji: "•﹏•", label: "焦虑", tone: "bg-[var(--life-blue)]" },
  { key: "sad", emoji: "｡•́︿•̀｡", label: "难过", tone: "bg-[var(--life-pink)]" },
  { key: "angry", emoji: "•̀⤙•́", label: "生气", tone: "bg-[var(--life-coral)]" },
  { key: "tired", emoji: "- ᴗ -", label: "疲惫", tone: "bg-[var(--life-blue)]" },
];

export function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function displayDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00`));
}

export function moodVisual(key?: MoodKey) {
  return MOODS.find((item) => item.key === key) ?? null;
}

export function formatTime(value?: string | null) {
  if (!value) return "--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function durationText(record?: SleepRecord) {
  if (!record) return "未记录";
  const minutes = Math.max(
    0,
    Math.round((new Date(record.wokeAt).getTime() - new Date(record.fellAsleepAt).getTime()) / 60000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分` : `${hours}小时`;
}

export function timeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function buildSleepTimestamps(date: string, sleepAt: string, wakeAt: string) {
  const sleep = new Date(`${date}T${sleepAt}:00`);
  const wake = new Date(`${date}T${wakeAt}:00`);
  if (wake.getTime() <= sleep.getTime()) wake.setDate(wake.getDate() + 1);
  return { fellAsleepAt: sleep.toISOString(), wokeAt: wake.toISOString() };
}
