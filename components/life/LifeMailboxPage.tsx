"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { createMailboxItem, deleteMailboxItem, fetchMailboxLetters, updateMailboxItem } from "@/lib/life/mailbox-client";
import type { MailboxLetter, MailboxPartnerKey, MailboxWritePayload } from "@/lib/life/mailbox-service";

type Tab = "received" | "sent";

function dateText(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

export function LifeMailboxPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [letters, setLetters] = useState<MailboxLetter[]>([]);
  const [tab, setTab] = useState<Tab>("received");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MailboxLetter | null | undefined>(undefined);
  const [form, setForm] = useState<MailboxWritePayload | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMailboxLetters().then((items) => { if (active) { setLetters(items); setError(null); } }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "小信箱暂时没有打开"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    if (!mePartnerKey) return [];
    return letters.filter((letter) => tab === "received" ? letter.recipientKey === mePartnerKey : letter.senderKey === mePartnerKey);
  }, [letters, mePartnerKey, tab]);

  function roleLabel(key: MailboxPartnerKey) {
    return key === mePartnerKey ? "我" : "Ta";
  }

  async function reload() { setLetters(await fetchMailboxLetters()); }
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
      if (editing) await updateMailboxItem(editing.id, ownedForm); else await createMailboxItem(ownedForm);
      await reload(); setEditing(undefined); setForm(null); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存信件失败"); }
    finally { setSaving(false); }
  }
  async function remove(letter: MailboxLetter) {
    if (!mePartnerKey || letter.senderKey !== mePartnerKey) return;
    if (!window.confirm("把这封信从小信箱里移除吗？")) return;
    try { await deleteMailboxItem(letter.id); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "删除信件失败"); }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title="小信箱" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return <AppPageShell title="小信箱" subtitle="“我”是当前登录的人，收到/寄出都会随账号切换。" actions={<Link href="/nest" className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-extrabold text-[var(--life-teal-strong)]">返回小窝</Link>}>
    <section className="life-surface life-section-card">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 rounded-full bg-[var(--life-surface-soft)] p-1 text-xs font-extrabold">
          <button onClick={() => setTab("received")} className={`rounded-full px-3 py-2 ${tab === "received" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>收到的</button>
          <button onClick={() => setTab("sent")} className={`rounded-full px-3 py-2 ${tab === "sent" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>寄出的</button>
        </div>
        <button onClick={openCreate} className="shrink-0 rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-xs font-extrabold text-white">写一封</button>
      </div>
    </section>

    {error ? <div className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{error}</div> : null}
    <div className="mt-3 grid gap-3">
      {loading ? <div className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在翻信箱…</div> : null}
      {!loading && visible.length === 0 ? <div className="life-surface life-section-card text-center"><div className="text-3xl">💌</div><p className="mt-2 text-sm font-bold text-[var(--life-text-body)]">这里还没有信</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">想说的话可以慢慢写下来。</p></div> : null}
      {visible.map((letter, index) => <article key={letter.id} className={`relative overflow-hidden rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] p-4 shadow-[var(--life-shadow-soft)] ${letter.format === "postcard" ? "bg-[color:color-mix(in_srgb,var(--life-blue)_18%,white)]" : index % 2 ? "bg-[color:color-mix(in_srgb,var(--life-yellow)_15%,white)]" : "bg-[var(--life-surface)]"}`}>
        <div className="absolute right-4 top-4 rotate-6 rounded-md border border-[var(--life-border)] bg-white/70 px-2 py-1 text-[10px]">{letter.format === "postcard" ? "POSTCARD" : "LETTER"}</div>
        <p className="pr-20 text-[11px] font-extrabold text-[var(--life-text-muted)]">{roleLabel(letter.senderKey)} → {roleLabel(letter.recipientKey)} · {dateText(letter.sentAt)}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--life-text-body)]">{letter.body}</p>
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
