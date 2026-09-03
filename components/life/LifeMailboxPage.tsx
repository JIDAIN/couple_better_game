"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { createMailboxItem, deleteMailboxItem, fetchMailboxLetters, updateMailboxItem } from "@/lib/life/mailbox-client";
import type { MailboxFormat, MailboxLetter, MailboxPartnerKey, MailboxWritePayload } from "@/lib/life/mailbox-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

type Tab = "received" | "sent";
type FormatFilter = "all" | MailboxFormat;
const EMPTY_LETTERS: MailboxLetter[] = [];
const THEMES = [
  { key: "cream", label: "奶油", swatch: "🍪" },
  { key: "forest", label: "森林", swatch: "🌿" },
  { key: "sea", label: "海边", swatch: "🐚" },
  { key: "sunset", label: "晚霞", swatch: "🌇" },
] as const;

function monthKey(value: string) { return value.slice(0, 7); }
function monthText(value: string) { const [year, month] = value.split("-").map(Number); return `${year}年${month}月`; }
function monthShortText(value: string) { return `${Number(value.slice(5, 7))}月`; }
function dateText(value: string) {
  const d = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function firstSentence(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  const match = text.match(/^.*?[。！？.!?](?:\s|$)/);
  return (match?.[0] ?? text).trim();
}
function themeClass(themeKey: string) { return THEMES.some((theme) => theme.key === themeKey) ? `theme-${themeKey}` : "theme-cream"; }

export function LifeMailboxPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [tab, setTab] = useState<Tab>("received");
  const [month, setMonth] = useState("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MailboxLetter | null | undefined>(undefined);
  const [reading, setReading] = useState<MailboxLetter | null>(null);
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
  const visible = useMemo(() => tabLetters.filter((letter) => {
    const monthMatch = month === "all" || monthKey(letter.sentAt) === month;
    const formatMatch = formatFilter === "all" || letter.format === formatFilter;
    return monthMatch && formatMatch;
  }), [formatFilter, month, tabLetters]);

  function roleLabel(key: MailboxPartnerKey) { return key === mePartnerKey ? "我" : "Ta"; }
  function openCreate() {
    if (!mePartnerKey || !taPartnerKey) return;
    setEditing(null);
    setForm({ senderKey: mePartnerKey, recipientKey: taPartnerKey, format: "letter", title: "", themeKey: "cream", body: "", sentAt: null });
  }
  function openEdit(letter: MailboxLetter) {
    if (!mePartnerKey || letter.senderKey !== mePartnerKey) return;
    setReading(null);
    setEditing(letter);
    setForm({ senderKey: letter.senderKey, recipientKey: letter.recipientKey, format: letter.format, title: letter.title, themeKey: letter.themeKey, body: letter.body, sentAt: letter.sentAt });
  }
  async function save() {
    if (!form || !mePartnerKey || !taPartnerKey) return;
    if (form.format === "letter" && !(form.title ?? "").trim()) { setError("手札需要一个标题"); return; }
    const ownedForm = { ...form, senderKey: mePartnerKey, recipientKey: taPartnerKey, title: form.format === "letter" ? form.title : null };
    setSaving(true);
    try {
      const saved = editing ? await updateMailboxItem(editing.id, ownedForm) : await createMailboxItem(ownedForm);
      lettersQuery.update((current) => [saved, ...(current ?? []).filter((letter) => letter.id !== saved.id)]);
      setEditing(undefined); setForm(null); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }
  async function remove(letter: MailboxLetter) {
    if (!mePartnerKey || letter.senderKey !== mePartnerKey) return;
    if (!window.confirm("把这份内容从小信箱里移除吗？")) return;
    try {
      await deleteMailboxItem(letter.id);
      lettersQuery.update((current) => (current ?? []).filter((item) => item.id !== letter.id));
      if (reading?.id === letter.id) setReading(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return <AppPageShell title="小信箱" subtitle="正在确认当前账号…"><section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认当前账号…</section></AppPageShell>;
  }

  return <>
    <AppPageShell title="小信箱" subtitle="长长的手札，短短的明信片，都收在这里。" actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}>
      <section className="life-surface life-section-card life-toolbar">
        <div className="flex items-center justify-between gap-3">
          <div className="grid flex-1 grid-cols-2 rounded-full bg-[var(--life-surface-soft)] p-1 text-xs font-extrabold">
            <button onClick={() => { setTab("received"); setMonth("all"); }} className={`rounded-full px-3 py-2 ${tab === "received" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>收到的</button>
            <button onClick={() => { setTab("sent"); setMonth("all"); }} className={`rounded-full px-3 py-2 ${tab === "sent" ? "bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]" : "text-[var(--life-text-muted)]"}`}>寄出的</button>
          </div>
          <button onClick={openCreate} className="shrink-0 rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-xs font-extrabold text-white">写给 Ta</button>
        </div>

        <div className="life-mailbox-format-filter mt-3 grid grid-cols-3 gap-1 rounded-full bg-[var(--life-surface-soft)] p-1">
          {(["all", "letter", "postcard"] as FormatFilter[]).map((value) => (
            <button key={value} type="button" onClick={() => setFormatFilter(value)} className={formatFilter === value ? "is-active" : ""}>{value === "all" ? "所有" : value === "letter" ? "手札" : "明信片"}</button>
          ))}
        </div>

        <div className="life-mailbox-filter mt-3 flex items-center justify-between gap-3">
          <p className="text-xs font-extrabold text-[var(--life-text)]">时间归档</p>
          <label className="relative shrink-0">
            <span className="sr-only">筛选月份</span>
            <select value={month} onChange={(event) => setMonth(event.target.value)} className="life-mailbox-month-select appearance-none rounded-full border border-[var(--life-border-soft)] bg-white/80 py-2 pl-3 pr-8 text-xs font-extrabold text-[var(--life-teal-strong)] outline-none">
              <option value="all">全部月份</option>
              {months.map((value) => <option key={value} value={value}>{monthText(value)}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--life-teal-strong)]">⌄</span>
          </label>
        </div>
      </section>

      {visibleError ? <div className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">{visibleError}</div> : null}
      <div className="mt-3 grid gap-3">
        {!lettersQuery.loading && visible.length === 0 ? <div className="life-surface life-section-card text-center"><div className="text-3xl">💌</div><p className="mt-2 text-sm font-bold text-[var(--life-text-body)]">这里还没有手札或明信片</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">想说的话可以慢慢写下来。</p></div> : null}
        {visible.map((letter) => (
          <article key={letter.id} className={`life-letter-preview ${letter.format === "postcard" ? "is-postcard" : "is-letter"} ${themeClass(letter.themeKey)}`}>
            <button type="button" className="life-letter-preview-main text-left" onClick={() => setReading(letter)}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">{roleLabel(letter.senderKey)} → {roleLabel(letter.recipientKey)} · {monthShortText(monthKey(letter.sentAt))}{new Date(letter.sentAt).getDate()}日</p>
                <span className="life-letter-stamp">{letter.format === "postcard" ? "明信片" : "手札"}</span>
              </div>
              {letter.format === "letter" ? (
                <><h2 className="mt-3 line-clamp-1 text-base font-black text-[var(--life-text)]">{letter.title || "没有标题的手札"}</h2><p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--life-text-body)]">{letter.body}</p></>
              ) : (
                <><p className="mt-3 text-[10px] font-extrabold tracking-[0.14em] text-[var(--life-text-muted)]">POSTCARD</p><h2 className="mt-2 line-clamp-2 text-base font-black leading-6 text-[var(--life-text)]">{firstSentence(letter.body)}</h2></>
              )}
              <span className="life-letter-read-hint">点开阅读完整内容 <span aria-hidden>›</span></span>
            </button>
            {letter.senderKey === mePartnerKey ? <div className="life-letter-preview-actions"><button onClick={() => openEdit(letter)}>编辑</button><button onClick={() => void remove(letter)}>删除</button></div> : null}
          </article>
        ))}
      </div>
    </AppPageShell>

    {reading ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center" onMouseDown={() => setReading(null)}>
      <article className={`island-life-v2 life-letter-reader ${themeClass(reading.themeKey)}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">{roleLabel(reading.senderKey)} 写给 {roleLabel(reading.recipientKey)}</p><p className="mt-1 text-[10px] text-[var(--life-text-muted)]">{dateText(reading.sentAt)}</p></div>
          <button type="button" onClick={() => setReading(null)} className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-extrabold text-[var(--life-text-body)]">关闭</button>
        </div>
        {reading.format === "letter" ? <h2 className="mt-5 text-xl font-black text-[var(--life-text)]">{reading.title || "没有标题的手札"}</h2> : <p className="mt-5 text-xs font-extrabold tracking-[0.16em] text-[var(--life-text-muted)]">POSTCARD</p>}
        <p className="mt-4 whitespace-pre-wrap text-sm leading-8 text-[var(--life-text-body)]">{reading.body}</p>
        {reading.senderKey === mePartnerKey ? <button type="button" className="mt-5 text-xs font-extrabold text-[var(--life-teal-strong)]" onClick={() => openEdit(reading)}>编辑这份{reading.format === "letter" ? "手札" : "明信片"}</button> : null}
      </article>
    </div> : null}

    {editing !== undefined && form ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-3 sm:items-center">
      <div className="island-life-v2 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[var(--life-surface)] p-4 shadow-[var(--life-shadow-float)]">
        <div className="flex items-center justify-between"><h2 className="text-lg font-extrabold">{editing ? "编辑" : "写给 Ta"}</h2><button onClick={() => { setEditing(undefined); setForm(null); }} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-sm">关闭</button></div>
        <div className="mt-4 grid gap-3">
          <p className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--life-text-body)]">我 → Ta</p>
          <div><p className="mb-1 text-xs font-bold">样式</p><div className="grid grid-cols-2 gap-2"><button onClick={() => setForm({ ...form, format: "letter" })} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "letter" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>📖 手札</button><button onClick={() => setForm({ ...form, format: "postcard", title: null })} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "postcard" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>🏝️ 明信片</button></div></div>
          {form.format === "letter" ? <label className="text-xs font-bold">标题<input value={form.title ?? ""} maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="给这份手札起个名字" className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--life-teal)]" /></label> : null}
          <div><p className="mb-1 text-xs font-bold">纸张主题</p><div className="grid grid-cols-4 gap-2">{THEMES.map((theme) => <button key={theme.key} type="button" onClick={() => setForm({ ...form, themeKey: theme.key })} className={`life-mail-theme-choice ${form.themeKey === theme.key ? "is-active" : ""}`}><span>{theme.swatch}</span><small>{theme.label}</small></button>)}</div></div>
          <label className="text-xs font-bold">内容<textarea autoFocus value={form.body} maxLength={2000} onChange={(event) => setForm({ ...form, body: event.target.value })} rows={8} placeholder={form.format === "letter" ? "把想说很久的话慢慢写下来…" : "把一句想说的话写在明信片上…"} className="mt-1 w-full resize-none rounded-[var(--life-radius-card)] border border-[var(--life-border)] bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-[var(--life-teal)]" /><span className="mt-1 block text-right text-[10px] text-[var(--life-text-muted)]">{form.body.length}/2000</span></label>
          <button disabled={saving || !form.body.trim() || (form.format === "letter" && !(form.title ?? "").trim())} onClick={() => void save()} className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{saving ? "保存中…" : editing ? "保存修改" : "放进信箱"}</button>
        </div>
      </div>
    </div> : null}
  </>;
}
