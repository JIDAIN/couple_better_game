import type { MoodKey } from "./life-service";

export const MOOD_LABELS: Record<MoodKey, string> = {
  happy: "开心",
  calm: "平静",
  neutral: "心动",
  anxious: "烦躁",
  sad: "伤心",
  angry: "生气",
  tired: "心累",
  excited: "兴奋",
};

export function moodLabel(key: MoodKey) {
  return MOOD_LABELS[key];
}

export function withMoodLabel<T extends { moodKey: MoodKey }>(record: T) {
  return {
    ...record,
    moodLabel: moodLabel(record.moodKey),
  };
}
