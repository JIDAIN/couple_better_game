"use client";

import { useMemo, useState } from "react";
import { MoodIcon } from "@/components/ui/MoodIcon";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { saveMood } from "@/lib/life/life-client";
import type { LifeDayRecord, MoodKey } from "@/lib/life/life-service";
import { MOODS, moodVisual } from "./today-life-model";

export function TodayMoodCard({
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
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const moodByRole = useMemo(() => {
    const map = new Map(day.moods.map((item) => [item.partnerKey, item.moodKey] as const));
    return map;
  }, [day.moods]);

  async function choose(moodKey: MoodKey) {
    if (!mePartnerKey || readOnly || saving) return;
    // The choice itself is the confirmation: close immediately instead of showing a selected frame.
    setPickerOpen(false);
    setSaving(true);
    try {
      await saveMood({ partnerKey: mePartnerKey, moodDate: date, moodKey });
      if (onChanged) await onChanged();
    } catch (cause) {
      setPickerOpen(true);
      onError?.(cause instanceof Error ? cause.message : "保存心情失败");
    } finally {
      setSaving(false);
    }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section>;
  }

  const myMood = moodByRole.get(mePartnerKey);
  const taMood = moodByRole.get(taPartnerKey);

  return (
    <>
      <section className="life-surface life-section-card life-home-feature life-today-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-[var(--life-text)]">🍃 心情</p>
            <p className="mt-0.5 text-xs text-[var(--life-text-muted)]">各自记录，彼此看见。</p>
          </div>
          {!readOnly ? (
            <button type="button" className="life-card-action" onClick={() => setPickerOpen(true)}>
              {myMood ? "编辑" : "+ 记录"}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MoodFace label="我" moodKey={myMood} emphasized />
          <MoodFace label="Ta" moodKey={taMood} />
        </div>
      </section>

      {!readOnly && pickerOpen ? (
        <div className="life-sheet-backdrop" role="presentation" onMouseDown={() => !saving && setPickerOpen(false)}>
          <section className="life-mood-sheet life-mood-sheet-v2" role="dialog" aria-modal="true" aria-labelledby="mood-picker-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--life-border)]" />
            <div className="text-center">
              <p id="mood-picker-title" className="text-lg font-black text-[var(--life-text)]">现在感觉怎么样？</p>
              <p className="mt-1 text-xs text-[var(--life-text-muted)]">点一下就记录，不需要再确认。</p>
            </div>
            <div className="life-mood-choice-grid mt-5 grid grid-cols-4 gap-x-2 gap-y-4" role="radiogroup" aria-label="选择我的心情">
              {MOODS.map((mood) => (
                <button
                  key={mood.key}
                  type="button"
                  role="radio"
                  aria-checked={mood.key === myMood}
                  disabled={saving}
                  onClick={() => void choose(mood.key)}
                  className="life-mood-choice"
                >
                  <span className="life-mood-orb" aria-hidden><MoodIcon moodKey={mood.key} label="" /></span>
                  <span>{mood.label}</span>
                </button>
              ))}
            </div>
            <button type="button" disabled={saving} onClick={() => setPickerOpen(false)} className="life-mood-cancel mt-5 w-full rounded-full px-4 py-3 text-sm font-extrabold text-[var(--life-text-body)]">
              取消
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MoodFace({ label, moodKey, emphasized = false }: { label: string; moodKey?: MoodKey; emphasized?: boolean }) {
  const visual = moodVisual(moodKey);
  return (
    <div className={`life-person-state ${emphasized ? "is-me" : ""}`}>
      <div className="life-person-state-orb">
        {visual ? <MoodIcon moodKey={visual.key} label={visual.label} /> : <span aria-hidden>○</span>}
      </div>
      <p className="mt-2 text-xs font-bold text-[var(--life-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-[var(--life-text)]">{visual?.label ?? "未记录"}</p>
    </div>
  );
}