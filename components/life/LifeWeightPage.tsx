"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { AppRoleSwitch, type AppRoleSwitchValue } from "@/components/ui/AppRoleSwitch";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { fetchLifeSettings, patchLifeSettings } from "@/lib/life/settings-client";
import type { LifeSettings } from "@/lib/life/settings-service";
import { createWeightRecord, deleteWeightRecord, fetchWeights, updateWeightRecord, WeightApiError } from "@/lib/life/weight-client";
import type { WeightRecord, WeightWritePayload } from "@/lib/life/weight-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

const PERIODS = [
  { key: "week", label: "周" },
  { key: "month", label: "月" },
  { key: "quarter", label: "季度" },
  { key: "year", label: "年" },
] as const;
type Period = (typeof PERIODS)[number]["key"];
type DailyWeightPoint = { date: string; weightKg: number; count: number };
const EMPTY_WEIGHTS: WeightRecord[] = [];

function localDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function localTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function recordTimestamp(record: WeightRecord) {
  return record.measuredAt ? new Date(record.measuredAt).getTime() : new Date(`${record.measurementDate}T00:00:00`).getTime();
}
function sortWeightRecords(records: WeightRecord[]) {
  return [...records].sort((a, b) => recordTimestamp(b) - recordTimestamp(a));
}
function exactTime(record: WeightRecord) {
  if (!record.measuredAt) return "时间未记录";
  return new Date(record.measuredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function shortDate(date: string) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}
function dailyAverages(records: WeightRecord[]): DailyWeightPoint[] {
  const groups = new Map<string, number[]>();
  records.forEach((record) => {
    const bucket = groups.get(record.measurementDate) ?? [];
    bucket.push(Number(record.weightKg));
    groups.set(record.measurementDate, bucket);
  });
  return [...groups.entries()]
    .map(([date, values]) => ({ date, weightKg: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}
function referenceDateForYear(year: number) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = Math.min(now.getDate(), daysInMonth(year, month));
  return new Date(year, month - 1, day, 12, 0, 0);
}
function periodBounds(year: number, period: Period) {
  const reference = referenceDateForYear(year);
  if (period === "year") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (period === "month") {
    const month = reference.getMonth() + 1;
    return {
      start: `${year}-${String(month).padStart(2, "0")}-01`,
      end: `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`,
    };
  }
  if (period === "quarter") {
    const startMonth = Math.floor(reference.getMonth() / 3) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      start: `${year}-${String(startMonth).padStart(2, "0")}-01`,
      end: `${year}-${String(endMonth).padStart(2, "0")}-${String(daysInMonth(year, endMonth)).padStart(2, "0")}`,
    };
  }
  const end = reference;
  const start = new Date(reference);
  start.setDate(start.getDate() - 6);
  return { start: localDate(start), end: localDate(end) };
}
function measuredAtFrom(date: string, time: string) {
  if (!time) return null;
  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function WeightChart({ points }: { points: DailyWeightPoint[] }) {
  if (points.length < 2) {
    return <div className="grid h-40 place-items-center rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-4 text-center text-xs font-bold text-[var(--life-text-muted)]">这个区间至少需要 2 个有记录的日期，才会出现趋势线。</div>;
  }
  const weights = points.map((item) => item.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const spread = Math.max(max - min, 1);
  const coords = points.map((item, index) => ({
    x: (index / (points.length - 1)) * 100,
    y: 88 - ((item.weightKg - min) / spread) * 68,
    item,
  }));
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  return (
    <div className="life-weight-chart rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] p-3">
      <svg viewBox="0 0 100 100" className="h-40 w-full overflow-visible" role="img" aria-label="按每日平均体重绘制的趋势图">
        <line x1="0" y1="88" x2="100" y2="88" stroke="currentColor" className="text-[var(--life-border-soft)]" strokeWidth="0.7" />
        <polyline points={line} fill="none" stroke="currentColor" className="text-[var(--life-teal-strong)]" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => <circle key={point.item.date} cx={point.x} cy={point.y} r="2.3" fill="currentColor" className="text-[var(--life-teal-strong)]" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-[var(--life-text-muted)]">
        <span>{shortDate(points[0].date)}</span>
        <span>{min.toFixed(1)}–{max.toFixed(1)} kg · 每日均值</span>
        <span>{shortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}

export function LifeWeightPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [role, setRole] = useState<AppRoleSwitchValue>("me");
  const [period, setPeriod] = useState<Period>("month");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<WeightRecord | null>(null);
  const [date, setDate] = useState(() => localDate());
  const [time, setTime] = useState(() => localTime());
  const [weight, setWeight] = useState("");
  const [targetEditing, setTargetEditing] = useState(false);
  const [targetDraft, setTargetDraft] = useState("");
  const partnerKey = role === "me" ? mePartnerKey : taPartnerKey;
  const canEdit = role === "me";
  const fetcher = useCallback(() => partnerKey ? fetchWeights(partnerKey) : Promise.resolve([]), [partnerKey]);
  const recordsQuery = useStaleQuery<WeightRecord[]>({ key: `weights:${partnerKey ?? "pending"}`, fetcher, staleMs: 30_000 });
  const settingsQuery = useStaleQuery<LifeSettings>({ key: "life-settings", fetcher: fetchLifeSettings, staleMs: 60_000 });
  const records = useMemo(() => sortWeightRecords(recordsQuery.data ?? EMPTY_WEIGHTS), [recordsQuery.data]);
  const visibleError = error ?? recordsQuery.error?.message ?? settingsQuery.error?.message ?? null;

  const bounds = useMemo(() => periodBounds(year, period), [period, year]);
  const dailyPoints = useMemo(() => dailyAverages(records).filter((item) => item.date >= bounds.start && item.date <= bounds.end), [bounds.end, bounds.start, records]);
  const yearRecords = useMemo(() => records.filter((item) => item.measurementDate.startsWith(`${year}-`)), [records, year]);
  const latest = records[0] ?? null;
  const previous = records[1] ?? null;
  const latestChange = latest && previous ? Number(latest.weightKg) - Number(previous.weightKg) : null;
  const targetWeight = partnerKey ? settingsQuery.data?.targetWeights[partnerKey] ?? null : null;

  function switchRole(next: AppRoleSwitchValue) {
    if (next === role) return;
    setEditing(null);
    setWeight("");
    setTargetEditing(false);
    setRole(next);
  }

  function edit(record: WeightRecord) {
    if (!canEdit || record.linkedDailyRecordSideId) return;
    setEditing(record);
    setDate(record.measurementDate);
    setTime(record.measuredAt ? new Date(record.measuredAt).toTimeString().slice(0, 5) : "");
    setWeight(String(record.weightKg));
  }

  function resetForm() {
    setEditing(null);
    setDate(localDate());
    setTime(localTime());
    setWeight("");
  }

  async function save() {
    if (!partnerKey || !canEdit) return;
    const value = Number(weight);
    if (!Number.isFinite(value) || value <= 0 || value >= 500) {
      setError("请输入有效体重（0–500 kg）");
      return;
    }
    const measuredAt = measuredAtFrom(date, time);
    if (!measuredAt) { setError("请填写精确记录时间"); return; }
    const payload: WeightWritePayload = {
      partnerKey,
      measurementDate: date,
      measuredAt,
      weightKg: value,
      note: null,
    };
    setSaving(true);
    setError(null);
    try {
      const saved = editing ? await updateWeightRecord(editing.id, payload) : await createWeightRecord(payload);
      recordsQuery.update((current) => sortWeightRecords([saved, ...(current ?? []).filter((item) => item.id !== saved.id)]));
      setYear(Number(saved.measurementDate.slice(0, 4)));
      resetForm();
    } catch (cause) {
      setError(cause instanceof WeightApiError ? cause.message : "体重记录暂时没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  async function saveTarget() {
    if (!canEdit) return;
    const value = Number(targetDraft);
    if (!Number.isFinite(value) || value <= 0 || value >= 500) { setError("请输入有效目标体重（0–500 kg）"); return; }
    setSaving(true); setError(null);
    try {
      const saved = await patchLifeSettings({ targetWeightKg: value });
      settingsQuery.update(saved);
      setTargetEditing(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "目标体重暂时没有保存成功"); }
    finally { setSaving(false); }
  }

  async function remove(record: WeightRecord) {
    if (!canEdit || record.linkedDailyRecordSideId) return;
    setSaving(true);
    setError(null);
    try {
      await deleteWeightRecord(record.id);
      recordsQuery.update((current) => (current ?? []).filter((item) => item.id !== record.id));
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
    <AppPageShell title="体重" subtitle="同一天记录多次也会完整保留，趋势图按当天平均值绘制。" actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}>
      <div className="grid gap-3">
        <AppRoleSwitch value={role} onChange={switchRole} />

        <section className="life-surface life-section-card life-weight-hero-v2">
          <div className="life-weight-current">
            <p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">当前体重</p>
            <p className="mt-1 text-3xl font-black tabular-nums text-[var(--life-text)]">{latest ? Number(latest.weightKg).toFixed(1) : "--"}<span className="ml-1 text-sm font-bold text-[var(--life-text-body)]">kg</span></p>
            <p className="mt-1 text-[11px] font-bold text-[var(--life-text-muted)]">{latestChange == null ? "暂无上次变化" : `较上次 ${latestChange > 0 ? "+" : ""}${latestChange.toFixed(1)} kg`}</p>
          </div>
          <div className="life-weight-target">
            <p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">目标体重</p>
            <p className="mt-1 text-xl font-black tabular-nums text-[var(--life-text)]">{targetWeight == null ? "--" : Number(targetWeight).toFixed(1)}<span className="ml-1 text-xs font-bold text-[var(--life-text-body)]">kg</span></p>
            {canEdit ? <button type="button" className="mt-1 text-[10px] font-extrabold text-[var(--life-teal-strong)]" onClick={() => { setTargetDraft(targetWeight == null ? "" : String(targetWeight)); setTargetEditing(true); }}>编辑目标</button> : <span className="mt-1 block text-[10px] text-[var(--life-text-muted)]">Ta 自己设置</span>}
          </div>
        </section>

        {targetEditing ? <section className="life-surface life-section-card flex items-end gap-2"><label className="grid min-w-0 flex-1 gap-1 text-xs font-bold text-[var(--life-text-body)]">目标体重 kg<AppInput inputMode="decimal" value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)} /></label><AppButton variant="primary" disabled={saving} onClick={() => void saveTarget()}>保存</AppButton><button type="button" className="life-inline-link pb-2" onClick={() => setTargetEditing(false)}>取消</button></section> : null}

        <section className="life-surface life-section-card life-data-section">
          <div className="life-weight-year-nav mb-3">
            <button type="button" className="life-year-arrow" aria-label="上一年" onClick={() => setYear((value) => value - 1)}><span aria-hidden>‹</span></button>
            <strong>{year} 年</strong>
            <button type="button" className="life-year-arrow" aria-label="下一年" onClick={() => setYear((value) => value + 1)}><span aria-hidden>›</span></button>
          </div>
          <div className="life-weight-period-switch mb-3 grid grid-cols-4 gap-1">
            {PERIODS.map((item) => <button key={item.key} type="button" onClick={() => setPeriod(item.key)} className={period === item.key ? "is-active" : ""}>{item.label}</button>)}
          </div>
          <WeightChart points={dailyPoints} />
          <p className="mt-2 text-[10px] leading-5 text-[var(--life-text-muted)]">当前区间 {bounds.start} 至 {bounds.end}。一天记录多次时先求日平均，再进入折线图。</p>
        </section>

        {canEdit ? <section className="life-surface life-section-card life-data-section">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="text-sm font-extrabold text-[var(--life-text)]">{editing ? "编辑记录" : "记录体重"}</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">日期、精确时间和体重；不再记录备注。</p></div>
            {editing ? <button type="button" onClick={resetForm} className="text-xs font-extrabold text-[var(--life-teal-strong)]">取消编辑</button> : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-3 grid gap-1 text-xs font-bold text-[var(--life-text-body)] sm:col-span-1">日期<AppInput type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">时间<AppInput type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-[var(--life-text-body)]">体重 kg<AppInput inputMode="decimal" placeholder="52.6" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
          </div>
          <div className="mt-3"><AppButton variant="primary" disabled={saving} onClick={() => void save()}>{saving ? "保存中…" : editing ? "保存修改" : "保存体重"}</AppButton></div>
        </section> : null}

        <section className="life-surface life-section-card life-data-section">
          <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-extrabold text-[var(--life-text)]">{year} 年记录</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">每次测量都保留，不因为同一天多次而覆盖。</p></div><span className="text-[10px] font-bold text-[var(--life-text-muted)]">{yearRecords.length} 条</span></div>
          <div className="life-weight-history-list">
            {!recordsQuery.loading && yearRecords.length === 0 ? <p className="rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] px-3 py-3 text-xs font-bold text-[var(--life-text-muted)]">这一年还没有体重记录</p> : null}
            {yearRecords.map((record) => (
              <div key={record.id} className="life-weight-history-row">
                <div className="life-weight-history-date"><strong>{Number(record.measurementDate.slice(5, 7))}月{Number(record.measurementDate.slice(8, 10))}日</strong><span>{exactTime(record)}</span></div>
                <div className="life-weight-history-value"><strong>{Number(record.weightKg).toFixed(1)}</strong><span>kg</span></div>
                {canEdit && !record.linkedDailyRecordSideId ? <div className="life-weight-history-actions"><button type="button" onClick={() => edit(record)}>编辑</button><button type="button" disabled={saving} onClick={() => void remove(record)}>删除</button></div> : <span className="text-[9px] font-bold text-[var(--life-text-muted)]">{record.linkedDailyRecordSideId ? "旧数据" : "只读"}</span>}
              </div>
            ))}
          </div>
        </section>

        {visibleError ? <div className="rounded-[var(--life-radius-control)] bg-[color:color-mix(in_srgb,var(--life-coral)_16%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{visibleError}</div> : null}
      </div>
    </AppPageShell>
  );
}
