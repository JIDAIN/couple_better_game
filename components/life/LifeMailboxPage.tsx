"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { createMailboxItem, deleteMailboxItem, fetchMailboxLetters, updateMailboxItem } from "@/lib/life/mailbox-client";
import type { MailboxLetter, MailboxPartnerKey, MailboxWritePayload } from "@/lib/life/mailbox-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

type Tab = "received" | "sent";
const EMPTY_LETTERS: MailboxLetter[] = [];

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthText(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}

function monthShortText(value: string) {
  return `${Number(value.slice(5, 7))}月`;
}

function dateText(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

export function LifeMailboxPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [tab, setTab] = useState<Tab>("received");
  const [month, setMonth] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MailboxLetter | null | undefined>(undefined);
  const [form, setForm] = useState<MailboxWritePayload | null>(null);
  const [saving, setSaving] = useState(false);

  const fetcher = useCallback(() => fetchMailboxLetters(), []);
  const lettersQuery = useStaleQuery<MailboxLetter[]>({ key: "mailbox", fetcher, staleMs: 30_000 });
  const letters = lettersQuery.data ?? EMPTY_LETTERS;
  const visibleError = error ?? lettersQuery.error?.message ?? null;

  const tabLetters = useMemo(() => {
    if (!mePartnerKey) return [];
    return letters.filter((letter) => tab === "received" ? letter.recipientKey === mePartnerKey : letter.senderKey === mePartnerKey);
  }, [letters, mePartnerKey, tab]);
  const months = useMemo(() => Array.from(new Set(tabLetters.map((letter) => monthKey(letter.sentAt)))).sort((a, b) => b.localeCompare(a)), [tabLetters]);
  const visible = useMemo(() => month === "all" ? tabLetters : tabLetters.filter((letter) => monthKey(letter.sentAt) === month), [month, tabLetters]);

  function roleLabel(key: MailboxPartnerKey) {
    return key === mePartnerKey ? "我" : "Ta";
  }

  function openCreate() {
    if (!mePartnerKey || !taPartnerKey) return;
    setEditing(null);
    setForm({ senderKey: mePartnerKey, recipientKey: taPartnerKey, format: "letter", body: "", sentAt: null });
  }
  function openEdit(letter: MailboxLetter) {
    if (!mePartnerKey || letter.senderKey !== mePartnerKey) return;
    setEditing(letter);
    setForm({ senderKey: letter.senderKey, recipientKey: letter.recipientKey, format: letter.format, body: letter.body, sentAt: letter.sentAt });
  }
  async function save() {
    if (!form || !mePartnerKey || !taPartnerKey) return;
    const ownedForm = { ...form, senderKey: mePartnerKey, recipientKey: taPartnerKey };
    setSaving(true);
    try {
      const saved = editing ? await updateMailboxItem(editing.id, ownedForm) : await createMailboxItem(ownedForm);
      lettersQuery.update((current) => [saved, ...(current ?? []).filter((letter) => letter.id !== saved.id)]);
      setEditing(undefined); setForm(null); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存信件失败"); }
    finally { setSaving(false); }
  }
  async function remove(letter: MailboxLetter) {
    if (!mePartnerKey || letter.senderKey !== mePartnerKey) return;
    if (!window.confirm("把这封信从小信箱里移除吗？")) return;
    try { await deleteMailboxItem(letter.id); lettersQuery.update((current) => (current ?? []).filter((item) => item.id !== letter.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : "删除信件失败"); }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title="小信箱" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return <AppPageShell title="小信箱" subtitle="写给彼此的话，慢慢留在这里。" actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}>
    <section className="life-surface life-section-card life-toolbar">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 rounded-full bg-[var(--life-surface-soft)] p-1 text-xs font-extrabold">
          <button onClick={() => { setTab("received"); setMonth("all"); }} className={`rounded-full px-3 py-2 ${tab === "received" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>收到的</button>
          <button onClick={() => { setTab("sent"); setMonth("all"); }} className={`rounded-full px-3 py-2 ${tab === "sent" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>寄出的</button>
        </div>
        <button onClick={openCreate} className="shrink-0 rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-xs font-extrabold text-white">写一封</button>
      </div>
      <div className="life-mailbox-filter mt-3 flex items-center justify-between gap-3">
        <div><p className="text-xs font-extrabold text-[var(--life-text)]">信件归档</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">按寄出月份慢慢翻看</p></div>
        <label className="relative shrink-0">
          <span className="sr-only">筛选信件月份</span>
          <select value={month} onChange={(event) => setMonth(event.target.value)} className="life-mailbox-month-select appearance-none rounded-full border border-[var(--life-border-soft)] bg-white/80 py-2 pl-3 pr-8 text-xs font-extrabold text-[var(--life-teal-strong)] outline-none">
            <option value="all">全部信件</option>
            {months.map((value) => <option key={value} value={value}>{monthText(value)}</option>)}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--life-teal-strong)]">⌄</span>
        </label>
      </div>
    </section>

    {visibleError ? <div className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{visibleError}</div> : null}
    <div className="mt-3 grid gap-3">
      {!lettersQuery.loading && visible.length === 0 ? <div className="life-surface life-section-card text-center"><div className="text-3xl">💌</div><p className="mt-2 text-sm font-bold text-[var(--life-text-body)]">这里还没有信</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">想说的话可以慢慢写下来。</p></div> : null}
      {visible.map((letter, index) => <article key={letter.id} className={`life-letter-card life-letter-card--${index % 3} relative overflow-hidden ${letter.format === "postcard" ? "is-postcard" : "is-letter"}`}>
        <div className="life-letter-date"><span>{new Date(letter.sentAt).getDate()}</span><small>{monthShortText(monthKey(letter.sentAt))}</small></div>
        <div className="life-letter-content">
          <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-extrabold text-[var(--life-text-muted)]">{roleLabel(letter.senderKey)} 写给 {roleLabel(letter.recipientKey)}</p><span className="life-letter-stamp">{letter.format === "postcard" ? "明信片" : "信笺"}</span></div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--life-text-body)]">{letter.body}</p>
          <p className="mt-3 text-[10px] text-[var(--life-text-muted)]">{dateText(letter.sentAt)}</p>
        </div>
        {letter.senderKey === mePartnerKey ? <div className="mt-4 flex justify-end gap-2"><button onClick={() => openEdit(letter)} className="rounded-full bg-white/65 px-3 py-1.5 text-xs font-extrabold text-[var(--life-teal-strong)]">编辑</button><button onClick={() => void remove(letter)} className="rounded-full px-3 py-1.5 text-xs font-bold text-[var(--life-danger)]">删除</button></div> : null}
      </article>)}
    </div>

    {editing !== undefined && form ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center">
      <div className="island-life-v2 w-full max-w-lg rounded-[28px] bg-[var(--life-surface)] p-4 shadow-[var(--life-shadow-float)]">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editing ? "编辑这封信" : "写一封信"}</h2><button onClick={() => { setEditing(undefined); setForm(null); }} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-sm">关闭</button></div>
        <div className="mt-4 grid gap-3">
          <p className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--life-text-body)]">我 → Ta</p>
          <div><p className="mb-1 text-xs font-bold">纸张</p><div className="grid grid-cols-2 gap-2"><button onClick={() => setForm({ ...form, format: "letter" })} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "letter" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>✉️ 信纸</button><button onClick={() => setForm({ ...form, format: "postcard" })} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "postcard" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>🏝️ 明信片</button></div></div>
          <label className="text-xs font-bold">写给 Ta<textarea autoFocus value={form.body} maxLength={2000} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={8} placeholder="今天想告诉 Ta 什么？" className="mt-1 w-full resize-none rounded-[var(--life-radius-card)] border border-[var(--life-border)] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[var(--life-teal)]" /><span className="mt-1 block text-right text-[10px] text-[var(--life-text-muted)]">{form.body.length}/2000</span></label>
          <button disabled={saving || !form.body.trim()} onClick={() => void save()} className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{saving ? "保存中…" : editing ? "保存这封信" : "放进信箱"}</button>
        </div>
      </div>
    </div> : null}
  </AppPageShell>;
}
