"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppRoleSwitch, type AppRoleSwitchValue } from "@/components/ui/AppRoleSwitch";
import { AppTextarea } from "@/components/ui/AppTextarea";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { createWeightRecord, deleteWeightRecord, fetchWeights, updateWeightRecord, WeightApiError } from "@/lib/life/weight-client";
import type { WeightRecord, WeightWritePayload } from "@/lib/life/weight-service";

const RANGES = [
  { days: 7, label: "7天" },
  { days: 30, label: "30天" },
  { days: 90, label: "90天" },
  { days: 0, label: "全部" },
] as const;

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function WeightChart({ records }: { records: WeightRecord[] }) {
  const points = [...records].reverse();
  if (points.length < 2) {
    return <div className="grid h-40 place-items-center rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-4 text-center text-xs font-bold text-[var(--life-text-muted)]">至少有 2 条记录后，这里会出现趋势线。</div>;
  }
  const weights = points.map((item) => Number(item.weightKg));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const spread = Math.max(max - min, 1);
  const coords = points.map((item, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 88 - ((Number(item.weightKg) - min) / spread) * 68;
    return { x, y, item };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] p-3">
      <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible" role="img" aria-label="体重趋势图">
        <line x1="0" y1="88" x2="100" y2="88" stroke="currentColor" className="text-[var(--life-border-soft)]" strokeWidth="0.7" />
        <polyline points={line} fill="none" stroke="currentColor" className="text-[var(--life-teal-strong)]" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => <circle key={point.item.id} cx={point.x} cy={point.y} r="2.3" fill="currentColor" className="text-[var(--life-teal-strong)]" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-[var(--life-text-muted)]">
        <span>{shortDate(points[0].measurementDate)}</span>
        <span>{min.toFixed(1)}–{max.toFixed(1)} kg</span>
        <span>{shortDate(points[points.length - 1].measurementDate)}</span>
      </div>
    </div>
  );
}

export function LifeWeightPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [role, setRole] = useState<AppRoleSwitchValue>("me");
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WeightRecord | null>(null);
  const [date, setDate] = useState(() => localDate());
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const partnerKey = role === "me" ? mePartnerKey : taPartnerKey;
  const canEdit = role === "me";

  useEffect(() => {
    if (!partnerKey) return;
    let cancelled = false;
    fetchWeights(partnerKey)
      .then((data) => { if (!cancelled) { setRecords(data); setError(null); } })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof WeightApiError ? cause.message : "体重记录暂时没有加载出来"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [partnerKey]);

  const filtered = useMemo(() => {
    if (!range) return records;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (range - 1));
    return records.filter((item) => new Date(`${item.measurementDate}T12:00:00`) >= cutoff);
  }, [range, records]);

  const latest = records[0] ?? null;
  const oldestVisible = filtered[filtered.length - 1] ?? null;
  const change = latest && oldestVisible ? Number(latest.weightKg) - Number(oldestVisible.weightKg) : null;

  function switchRole(next: AppRoleSwitchValue) {
    if (next === role) return;
    setLoading(true);
    setEditing(null);
    setWeight("");
    setNote("");
    setRole(next);
  }

  function edit(record: WeightRecord) {
    if (!canEdit || record.linkedDailyRecordSideId) return;
    setEditing(record);
    setDate(record.measurementDate);
    setWeight(String(record.weightKg));
    setNote(record.note ?? "");
  }

  function resetForm() {
    setEditing(null);
    setDate(localDate());
    setWeight("");
    setNote("");
  }

  async function save() {
    if (!partnerKey || !canEdit) return;
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0 || value >= 500) {
      setError("请输入有效体重（0–500 kg）");
      return;
    }
    const payload: WeightWritePayload = {
      partnerKey,
      measurementDate: date,
      measuredAt: null,
      weightKg: value,
      note: note.trim() || null,
    };
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateWeightRecord(editing.id, payload);
      else await createWeightRecord(payload);
      const next = await fetchWeights(partnerKey);
      setRecords(next);
      resetForm();
    } catch (cause) {
      setError(cause instanceof WeightApiError ? cause.message : "体重记录暂时没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  async function remove(record: WeightRecord) {
    if (!canEdit || record.linkedDailyRecordSideId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteWeightRecord(record.id);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      if (editing?.id === record.id) resetForm();
    } catch (cause) {
      setError(cause instanceof WeightApiError ? cause.message : "这条记录暂时没有删除成功");
    } finally {
      setSaving(false);
    }
  }

  if (!partnerKey) {
    return <AppPageShell title="体重" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return (
    <AppPageShell title="体重" subtitle="记录变化，不评价数字。" actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}>
      <div className="grid gap-3">
        <AppRoleSwitch value={role} onChange={switchRole} />

        <section className="life-surface life-section-card life-weight-hero">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[var(--life-text-muted)]">最近一次记录</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-[var(--life-text)]">{latest ? Number(latest.weightKg).toFixed(1) : "--"}<span className="ml-1 text-sm font-bold text-[var(--life-text-body)]">kg</span></p>
              <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">{latest ? latest.measurementDate : "还没有体重记录"}</p>
            </div>
            {change != null && filtered.length > 1 ? (
              <div className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2 text-right">
                <p className="text-[10px] font-bold text-[var(--life-text-muted)]">当前区间变化</p>
                <p className="mt-0.5 text-sm font-extrabold tabular-nums text-[var(--life-text-body)]">{change > 0 ? "+" : ""}{change.toFixed(1)} kg</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="life-surface life-section-card life-data-section">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-[var(--life-text)]">最近趋势</p>
            <div className="flex gap-1 rounded-full bg-[var(--life-surface-soft)] p-1">
              {RANGES.map((item) => <button key={item.label} type="button" onClick={() => setRange(item.days)} className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${range === item.days ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-press)]" : "text-[var(--life-text-muted)]"}`}>{item.label}</button>)}
            </div>
          </div>
          <WeightChart records={filtered} />
          <p className="mt-2 text-[10px] leading-5 text-[var(--life-text-muted)]">折线只描述测量事实，不设置目标线、排名或“达标”评价。</p>
        </section>

        {canEdit ? <section className="life-surface life-section-card life-data-section">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[var(--life-text)]">{editing ? "修改记录" : "记一次体重"}</p>
              <p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">只能编辑当前登录账号自己的记录。</p>
            </div>
            {editing ? <button type="button" onClick={resetForm} className="text-xs font-extrabold text-[var(--life-teal-strong)]">取消修改</button> : null}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">日期<AppInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">体重 kg<AppInput inputMode="decimal" placeholder="例如 52.6" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
          </div>
          <div className="mt-2.5"><AppTextarea rows={2} placeholder="备注（可选）" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          <div className="mt-3"><AppButton variant="primary" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : editing ? "保存修改" : "保存体重"}</AppButton></div>
        </section> : <section className="life-surface life-section-card text-xs leading-5 text-[var(--life-text-muted)]">Ta 的体重在这里仅查看；Ta 登录自己的账号后，这一栏会自动变成“我”并可以记录。</section>}

        <section className="life-surface life-section-card life-data-section">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-sm font-extrabold text-[var(--life-text)]">历史记录</p><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{records.length} 条</span></div>
          <div className="grid gap-2">
            {loading ? <p className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--life-text-muted)]">正在读取记录…</p> : null}
            {!loading && records.length === 0 ? <p className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--life-text-muted)]">还没有体重记录</p> : null}
            {records.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2"><strong className="text-base tabular-nums text-[var(--life-text)]">{Number(record.weightKg).toFixed(1)} kg</strong><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{record.measurementDate}</span></div>
                  <p className="mt-0.5 truncate text-[10px] text-[var(--life-text-muted)]">{record.linkedDailyRecordSideId ? "来自旧游戏每日打卡" : record.note || "生活系统记录"}</p>
                </div>
                {canEdit && !record.linkedDailyRecordSideId ? <div className="flex shrink-0 gap-2"><button type="button" onClick={() => edit(record)} className="text-xs font-extrabold text-[var(--life-teal-strong)]">编辑</button><button type="button" disabled={saving} onClick={() => void remove(record)} className="text-xs font-extrabold text-[var(--life-danger)]">删除</button></div> : <span className="shrink-0 rounded-full bg-white/70 px-2 py-1 text-[9px] font-bold text-[var(--life-text-muted)]">{record.linkedDailyRecordSideId ? "游戏同步" : "只读"}</span>}
              </div>
            ))}
          </div>
        </section>

        {error ? <div className="rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_16%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
      </div>
    </AppPageShell>
  );
}
