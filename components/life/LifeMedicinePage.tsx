"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { createMedicineItem, deleteMedicineItem, fetchMedicines, updateMedicineItem } from "@/lib/life/medicine-client";
import { medicineStatus, type MedicineRecord, type MedicineStatus, type MedicineWritePayload } from "@/lib/life/medicine-service";

type Filter = "all" | MedicineStatus;
const statusText: Record<MedicineStatus, string> = { expired: "已过期", soon: "快过期", normal: "正常", unknown: "未填写有效期" };
const statusClass: Record<MedicineStatus, string> = {
  expired: "bg-[color:color-mix(in_srgb,var(--life-coral)_22%,white)] text-[var(--life-danger)]",
  soon: "bg-[color:color-mix(in_srgb,var(--life-yellow)_32%,white)] text-[var(--life-text)]",
  normal: "bg-[color:color-mix(in_srgb,var(--life-mint)_28%,white)] text-[var(--life-teal-strong)]",
  unknown: "bg-[var(--life-surface-soft)] text-[var(--life-text-muted)]",
};

const emptyForm: MedicineWritePayload = { name: "", productionDate: null, shelfLifeMonths: null, packageExpiryDate: null, openedDate: null, openedShelfLifeDays: null, quantity: 1, note: null };

function daysText(date: string | null) {
  if (!date) return "未填写有效期";
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(`${date}T00:00:00`);
  const days = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (days < 0) return `已过期 ${Math.abs(days)} 天`;
  if (days === 0) return "今天失效";
  return `还有 ${days} 天`;
}

export function LifeMedicinePage() {
  const [items, setItems] = useState<MedicineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<MedicineRecord | null | undefined>(undefined);
  const [form, setForm] = useState<MedicineWritePayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function reload() {
    try { setItems(await fetchMedicines()); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "药箱暂时没有加载出来"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(); }, []);

  const visible = useMemo(() => items.filter((item) => {
    const matches = item.name.toLowerCase().includes(query.trim().toLowerCase());
    const status = medicineStatus(item.finalExpiryDate);
    return matches && (filter === "all" || filter === status);
  }), [items, query, filter]);

  function openCreate() { setEditing(null); setForm(emptyForm); }
  function openEdit(item: MedicineRecord) {
    setEditing(item);
    setForm({ name: item.name, productionDate: item.productionDate, shelfLifeMonths: item.shelfLifeMonths, packageExpiryDate: item.packageExpiryDate, openedDate: item.openedDate, openedShelfLifeDays: item.openedShelfLifeDays, quantity: item.quantity, note: item.note });
  }
  async function save() {
    setSaving(true);
    try {
      if (editing) await updateMedicineItem(editing.id, form); else await createMedicineItem(form);
      setEditing(undefined); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  }
  async function remove(item: MedicineRecord) {
    if (!window.confirm(`删除“${item.name}”这条药箱记录？`)) return;
    try { await deleteMedicineItem(item.id); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "删除失败"); }
  }

  return <AppPageShell title="家庭药箱" subtitle="药都在这里；重点看数量和真正的最终失效日。" actions={<Link href="/nest" className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-extrabold text-[var(--life-teal-strong)]">返回小窝</Link>}>
    <section className="life-surface life-section-card">
      <div className="flex gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索药品" className="min-w-0 flex-1 rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--life-teal)]" />
        <button onClick={openCreate} className="rounded-2xl bg-[var(--life-teal)] px-4 py-2.5 text-sm font-extrabold text-white">＋ 添加</button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs font-bold">
        {(["all","soon","expired","normal","unknown"] as Filter[]).map((key) => <button key={key} onClick={() => setFilter(key)} className={`shrink-0 rounded-full px-3 py-1.5 ${filter===key ? "bg-[var(--life-teal)] text-white" : "bg-[var(--life-surface-soft)] text-[var(--life-text-body)]"}`}>{key === "all" ? "全部" : statusText[key]}</button>)}
      </div>
    </section>

    {error ? <div className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
    <div className="mt-3 grid gap-2.5">
      {loading ? <div className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在打开药箱…</div> : null}
      {!loading && !visible.length ? <div className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">没有符合条件的药品</div> : null}
      {visible.map((item) => {
        const status = medicineStatus(item.finalExpiryDate);
        return <article key={item.id} className="life-surface rounded-[var(--life-radius-card)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h2 className="font-extrabold text-[var(--life-text)]">{item.name}</h2><p className="mt-1 text-xs text-[var(--life-text-muted)]">数量 × {item.quantity}</p></div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${statusClass[status]}`}>{statusText[status]}</span>
          </div>
          <div className="mt-3 rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2.5 text-xs">
            <div className="flex justify-between gap-3"><span className="text-[var(--life-text-muted)]">最终失效</span><strong className="text-[var(--life-text-body)]">{item.finalExpiryDate ?? "未填写"}</strong></div>
            <p className="mt-1 text-right font-bold text-[var(--life-text-muted)]">{daysText(item.finalExpiryDate)}</p>
          </div>
          <div className="mt-3 flex justify-end gap-2"><button onClick={() => openEdit(item)} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--life-teal-strong)]">编辑</button><button onClick={() => void remove(item)} className="rounded-full px-3 py-1.5 text-xs font-bold text-[var(--life-danger)]">删除</button></div>
        </article>;
      })}
    </div>

    {editing !== undefined ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center">
      <div className="island-life-v2 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[var(--life-surface)] p-4 shadow-[var(--life-shadow-float)]">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editing ? "编辑药品" : "添加药品"}</h2><button onClick={() => setEditing(undefined)} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-sm">关闭</button></div>
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-bold">名称<input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm" /></label>
          <label className="text-xs font-bold">数量<input type="number" min="0" value={form.quantity} onChange={(e)=>setForm({...form,quantity:Number(e.target.value)})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">生产日期<input type="date" value={form.productionDate ?? ""} onChange={(e)=>setForm({...form,productionDate:e.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm" /></label><label className="text-xs font-bold">有效期（月）<input type="number" min="1" value={form.shelfLifeMonths ?? ""} onChange={(e)=>setForm({...form,shelfLifeMonths:e.target.value?Number(e.target.value):null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm" /></label></div>
          <label className="text-xs font-bold">包装失效日<input type="date" value={form.packageExpiryDate ?? ""} onChange={(e)=>setForm({...form,packageExpiryDate:e.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm" /></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">开封日期<input type="date" value={form.openedDate ?? ""} onChange={(e)=>setForm({...form,openedDate:e.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm" /></label><label className="text-xs font-bold">开封后有效天数<input type="number" min="1" value={form.openedShelfLifeDays ?? ""} onChange={(e)=>setForm({...form,openedShelfLifeDays:e.target.value?Number(e.target.value):null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm" /></label></div>
          <label className="text-xs font-bold">备注<textarea value={form.note ?? ""} onChange={(e)=>setForm({...form,note:e.target.value||null})} rows={2} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm" /></label>
          <button disabled={saving || !form.name.trim()} onClick={() => void save()} className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
        </div>
      </div>
    </div> : null}
  </AppPageShell>;
}
