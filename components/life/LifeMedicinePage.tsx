"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { createMedicineItem, deleteMedicineItem, fetchMedicines, updateMedicineItem } from "@/lib/life/medicine-client";
import { medicineStatus, type MedicineRecord, type MedicineStatus, type MedicineWritePayload } from "@/lib/life/medicine-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

type Filter = "all" | MedicineStatus;
const statusText: Record<MedicineStatus, string> = { expired: "已过期", soon: "快过期", normal: "正常", unknown: "日期未知" };
const emptyForm: MedicineWritePayload = { name: "", productionDate: null, shelfLifeMonths: null, packageExpiryDate: null, openedDate: null, openedShelfLifeDays: null, quantity: 1, note: null };
const EMPTY_MEDICINES: MedicineRecord[] = [];

function daysText(date: string | null) {
  if (!date) return "还没有填写最终失效日";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((new Date(`${date}T00:00:00`).getTime() - today.getTime()) / 86400000);
  return days < 0 ? `已过期 ${Math.abs(days)} 天` : days === 0 ? "今天失效" : `还有 ${days} 天`;
}
function expiryText(value: string | null) {
  if (!value) return "日期未知";
  return `${Number(value.slice(0, 4))}.${String(Number(value.slice(5, 7))).padStart(2, "0")}.${String(Number(value.slice(8, 10))).padStart(2, "0")}`;
}

function MedicineGlyph() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M16.5 12.5 35.5 31.5a8.5 8.5 0 0 1-12 12L4.5 24.5a8.5 8.5 0 0 1 12-12Z" stroke="currentColor" strokeWidth="2.8" />
      <path d="m13 33 20-20" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M8.8 20.2 27.8 39.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" opacity=".42" />
    </svg>
  );
}

function PencilIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 16.8-.8 3 3-.8L18 8.2 15.8 6 5 16.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="m14.8 7 2.2 2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function TrashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8.5h10m-8.5 0 .6 10h5.8l.6-10M9.5 6h5l.8 2.5H8.7L9.5 6Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function LifeMedicinePage() {
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<MedicineRecord | null | undefined>(undefined);
  const [form, setForm] = useState<MedicineWritePayload>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback(() => fetchMedicines(), []);
  const itemsQuery = useStaleQuery<MedicineRecord[]>({ key: "medicines", fetcher, staleMs: 30_000 });
  const items = itemsQuery.data ?? EMPTY_MEDICINES;
  const visibleError = error ?? itemsQuery.error?.message ?? null;
  const attentionCount = useMemo(() => items.filter((item) => ["soon", "expired"].includes(medicineStatus(item.finalExpiryDate))).length, [items]);

  const visible = useMemo(() => items.filter((item) => {
    const status = medicineStatus(item.finalExpiryDate);
    return item.name.toLowerCase().includes(query.trim().toLowerCase()) && (filter === "all" || filter === status);
  }).sort((a, b) => {
    if (!a.finalExpiryDate && !b.finalExpiryDate) return a.name.localeCompare(b.name, "zh-CN");
    if (!a.finalExpiryDate) return 1;
    if (!b.finalExpiryDate) return -1;
    return a.finalExpiryDate.localeCompare(b.finalExpiryDate);
  }), [items, query, filter]);

  function openEdit(item?: MedicineRecord) {
    if (!item) { setEditing(null); setForm(emptyForm); return; }
    setEditing(item);
    setForm({ name: item.name, productionDate: item.productionDate, shelfLifeMonths: item.shelfLifeMonths, packageExpiryDate: item.packageExpiryDate, openedDate: item.openedDate, openedShelfLifeDays: item.openedShelfLifeDays, quantity: item.quantity, note: item.note });
  }

  async function save() {
    setSaving(true);
    try {
      const saved = editing ? await updateMedicineItem(editing.id, form) : await createMedicineItem(form);
      itemsQuery.update((current) => [saved, ...(current ?? []).filter((item) => item.id !== saved.id)]);
      setEditing(undefined); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }

  async function remove(item: MedicineRecord) {
    if (!window.confirm(`删除“${item.name}”这条药箱记录？`)) return;
    try { await deleteMedicineItem(item.id); itemsQuery.update((current) => (current ?? []).filter((entry) => entry.id !== item.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
  }

  return <AppPageShell title="家庭药箱" subtitle="家里常备的东西，记得补，也记得看日期。" actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}>
    <div className="grid gap-3">
      <section className="life-medicine-overview">
        <div><span>药品</span><strong>{items.length}</strong><small>种</small></div>
        <div className={attentionCount ? "needs-attention" : ""}><span>需要留意</span><strong>{attentionCount}</strong><small>种</small></div>
      </section>

      <section className="life-medicine-toolbar">
        <div className="life-medicine-search-row">
          <label className="life-medicine-search"><span aria-hidden>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索药品" /></label>
          <button type="button" onClick={() => openEdit()} className="life-medicine-add">＋ 添加</button>
        </div>
        <div className="life-medicine-filter-row">
          {(["all", "soon", "expired", "normal", "unknown"] as Filter[]).map((key) => <button key={key} onClick={() => setFilter(key)} className={filter === key ? "is-active" : ""}>{key === "all" ? "全部" : statusText[key]}</button>)}
        </div>
      </section>

      {visibleError ? <p className="rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{visibleError}</p> : null}

      <section className="life-medicine-cards">
        {!itemsQuery.loading && !visible.length ? <div className="life-surface px-4 py-7 text-center text-sm text-[var(--life-text-muted)]">没有符合条件的药品</div> : null}
        {visible.map((item) => {
          const status = medicineStatus(item.finalExpiryDate);
          return <article key={item.id} className={`life-medicine-card status-${status}`}>
            <div className="life-medicine-glyph"><MedicineGlyph /></div>
            <div className="life-medicine-card-main">
              <div className="life-medicine-card-title"><h2>{item.name}</h2><span>{statusText[status]}</span></div>
              <p className="life-medicine-expiry"><strong>{expiryText(item.finalExpiryDate)}</strong><span>{daysText(item.finalExpiryDate)}</span></p>
            </div>
            <div className="life-medicine-stock"><strong>{item.quantity}</strong><span>件</span></div>
            <div className="life-medicine-card-actions">
              <button type="button" aria-label={`编辑 ${item.name}`} onClick={() => openEdit(item)}><PencilIcon /></button>
              <button type="button" aria-label={`删除 ${item.name}`} onClick={() => void remove(item)}><TrashIcon /></button>
            </div>
          </article>;
        })}
      </section>
    </div>

    {editing !== undefined ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center" onMouseDown={() => !saving && setEditing(undefined)}><div className="island-life-v2 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[var(--life-surface)] p-4" onMouseDown={(event) => event.stopPropagation()}><div className="flex justify-between"><h2 className="text-lg font-extrabold">{editing ? "编辑药品" : "添加药品"}</h2><button onClick={() => setEditing(undefined)}>关闭</button></div><div className="mt-4 grid gap-3">
      <label className="text-xs font-bold">名称<input value={form.name} onChange={(event) => setForm({...form,name:event.target.value})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm"/></label>
      <label className="text-xs font-bold">数量<input type="number" min="0" value={form.quantity} onChange={(event)=>setForm({...form,quantity:Number(event.target.value)})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm"/></label>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">生产日期<input type="date" value={form.productionDate??""} onChange={(event)=>setForm({...form,productionDate:event.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm"/></label><label className="text-xs font-bold">有效期（月）<input type="number" min="1" value={form.shelfLifeMonths??""} onChange={(event)=>setForm({...form,shelfLifeMonths:event.target.value?Number(event.target.value):null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm"/></label></div>
      <label className="text-xs font-bold">包装失效日<input type="date" value={form.packageExpiryDate??""} onChange={(event)=>setForm({...form,packageExpiryDate:event.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm"/></label>
      <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">开封日期<input type="date" value={form.openedDate??""} onChange={(event)=>setForm({...form,openedDate:event.target.value||null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm"/></label><label className="text-xs font-bold">开封后有效天数<input type="number" min="1" value={form.openedShelfLifeDays??""} onChange={(event)=>setForm({...form,openedShelfLifeDays:event.target.value?Number(event.target.value):null})} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-2 py-2.5 text-sm"/></label></div>
      <label className="text-xs font-bold">备注<textarea value={form.note??""} onChange={(event)=>setForm({...form,note:event.target.value||null})} rows={2} className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm"/></label>
      <button disabled={saving||!form.name.trim()} onClick={()=>void save()} className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{saving?"保存中…":"保存"}</button>
    </div></div></div> : null}
  </AppPageShell>;
}
