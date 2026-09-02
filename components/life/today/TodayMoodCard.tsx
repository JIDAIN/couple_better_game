"use client";

import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { saveMood } from "@/lib/life/life-client";
import type { LifeDayRecord, LifePartnerKey, MoodKey } from "@/lib/life/life-service";
import { MOODS, SELF_KEY, TA_KEY, moodVisual } from "./today-life-model";

export function TodayMoodCard({
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
  const [saving, setSaving] = useState<LifePartnerKey | null>(null);
  const moodByRole = useMemo(() => {
    const map = new Map<LifePartnerKey, MoodKey>();
    day.moods.forEach((item) => map.set(item.partnerKey, item.moodKey));
    return map;
  }, [day.moods]);

  async function choose(partnerKey: LifePartnerKey, moodKey: MoodKey) {
    setSaving(partnerKey);
    try {
      await saveMood({ partnerKey, moodDate: date, moodKey });
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "保存心情失败");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="life-surface life-section-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[var(--life-text)]">🍃 心情</p>
          <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">点一下就记好，不需要解释。</p>
        </div>
        <AppButton variant="ghost" onClick={() => setEditing((value) => !value)}>
          {editing ? "完成" : day.moods.length ? "修改" : "+ 记录"}
        </AppButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MoodFace label="我" moodKey={moodByRole.get(SELF_KEY)} />
        <MoodFace label="Ta" moodKey={moodByRole.get(TA_KEY)} />
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 border-t border-[var(--life-border-soft)] pt-4">
          <MoodEditor label="我" value={moodByRole.get(SELF_KEY)} disabled={saving === SELF_KEY} onChange={(key) => void choose(SELF_KEY, key)} />
          <MoodEditor label="Ta" value={moodByRole.get(TA_KEY)} disabled={saving === TA_KEY} onChange={(key) => void choose(TA_KEY, key)} />
        </div>
      ) : null}
    </section>
  );
}

function MoodFace({ label, moodKey }: { label: string; moodKey?: MoodKey }) {
  const visual = moodVisual(moodKey);
  return (
    <div className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface)] p-3 text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-base font-black text-[var(--life-text)] ${visual?.tone ?? "bg-[var(--life-surface-soft)]"}`}>
        {visual?.emoji ?? "+"}
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--life-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-[var(--life-text)]">{visual?.label ?? "未记录"}</p>
    </div>
  );
}

function MoodEditor({ label, value, disabled, onChange }: { label: string; value?: MoodKey; disabled: boolean; onChange: (key: MoodKey) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[var(--life-text-body)]">{label}</p>
      <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label={`${label} 心情`}>
        {MOODS.map((mood) => (
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
            <span className={`grid h-8 w-8 place-items-center rounded-full text-[9px] font-black ${mood.tone}`}>{mood.emoji}</span>
            <span className="hidden text-[9px] sm:block">{mood.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
