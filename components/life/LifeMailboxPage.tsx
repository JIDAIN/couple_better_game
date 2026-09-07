"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import {
  createMailboxItem,
  deleteMailboxItem,
  fetchMailboxLetters,
  sendMailboxItem,
  updateMailboxItem,
} from "@/lib/life/mailbox-client";
import type {
  MailboxFormat,
  MailboxLetter,
  MailboxPartnerKey,
  MailboxWritePayload,
} from "@/lib/life/mailbox-service";
import { useStaleQuery } from "@/lib/client/use-stale-query";

type Tab = "inbox" | "sent" | "draft";
type FormatFilter = "all" | MailboxFormat;

const EMPTY_LETTERS: MailboxLetter[] = [];
const PAGE_BREAK = "\n\f\n";
const LETTER_PAGE_CHARS = 460;
const THEMES = [
  { key: "cream", label: "奶油", swatch: "🍪" },
  { key: "forest", label: "森林", swatch: "🌿" },
  { key: "sea", label: "海边", swatch: "🐚" },
  { key: "sunset", label: "晚霞", swatch: "🌇" },
] as const;

function monthKey(value: string | null) {
  return value ? value.slice(0, 7) : "";
}
function monthText(value: string) {
  const [year, month] = value.split("-").map(Number);
  return `${year}年${month}月`;
}
function dateText(value: string | null) {
  if (!value) return "尚未寄出";
  const d = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
function firstSentence(value: string) {
  const text = value.replaceAll(PAGE_BREAK, "\n").trim().replace(/\s+/g, " ");
  const match = text.match(/^.*?[。！？.!?](?:\s|$)/);
  return (match?.[0] ?? text).trim();
}
function themeClass(themeKey: string) {
  return THEMES.some((theme) => theme.key === themeKey)
    ? `theme-${themeKey}`
    : "theme-cream";
}
function splitLetterPages(value: string) {
  if (value.includes(PAGE_BREAK)) {
    const explicit = value.split(PAGE_BREAK);
    return explicit.length ? explicit : [""];
  }
  if (!value) return [""];
  const pages: string[] = [];
  for (let index = 0; index < value.length; index += LETTER_PAGE_CHARS) {
    pages.push(value.slice(index, index + LETTER_PAGE_CHARS));
  }
  return pages.length ? pages : [""];
}
function bodyFromPages(pages: string[]) {
  return pages.join(PAGE_BREAK);
}
function readableBody(value: string) {
  return value.replaceAll(PAGE_BREAK, "\n");
}

function MailboxTabIcon({ tab }: { tab: Tab }) {
  if (tab === "sent") {
    return (
      <svg viewBox="0 0 48 36" className="h-8 w-11" fill="none" aria-hidden>
        <path d="M5 28 41 6 28 31l-7-10-16 7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m21 21 20-15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (tab === "draft") {
    return (
      <svg viewBox="0 0 48 36" className="h-8 w-11" fill="none" aria-hidden>
        <path d="M6 10h26v19H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m6 11 13 10 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m28 24 10-10 4 4-10 10-6 2 2-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 36" className="h-8 w-11" fill="none" aria-hidden>
      <path d="M5 12h38v19H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="m5 13 19 13 19-13" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M24 3v11m0 0-5-5m5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LifeMailboxPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [tab, setTab] = useState<Tab>("inbox");
  const [month, setMonth] = useState("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<MailboxLetter | null | undefined>(undefined);
  const [reading, setReading] = useState<MailboxLetter | null>(null);
  const [readerPage, setReaderPage] = useState(0);
  const [form, setForm] = useState<MailboxWritePayload | null>(null);
  const [letterPages, setLetterPages] = useState<string[]>([""]);
  const [editorPage, setEditorPage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetcher = useCallback(() => fetchMailboxLetters(), []);
  const lettersQuery = useStaleQuery<MailboxLetter[]>({
    key: "mailbox",
    fetcher,
    staleMs: 30_000,
  });
  const letters = lettersQuery.data ?? EMPTY_LETTERS;
  const visibleError = error ?? lettersQuery.error?.message ?? null;

  const counts = useMemo(() => {
    if (!mePartnerKey) return { inbox: 0, sent: 0, draft: 0 };
    return {
      inbox: letters.filter((item) => item.status === "sent" && item.recipientKey === mePartnerKey).length,
      sent: letters.filter((item) => item.status === "sent" && item.senderKey === mePartnerKey).length,
      draft: letters.filter((item) => item.status === "draft" && item.senderKey === mePartnerKey).length,
    };
  }, [letters, mePartnerKey]);

  const tabLetters = useMemo(() => {
    if (!mePartnerKey) return [];
    if (tab === "draft") {
      return letters
        .filter((item) => item.status === "draft" && item.senderKey === mePartnerKey)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    if (tab === "sent") {
      return letters.filter((item) => item.status === "sent" && item.senderKey === mePartnerKey);
    }
    return letters.filter((item) => item.status === "sent" && item.recipientKey === mePartnerKey);
  }, [letters, mePartnerKey, tab]);

  const months = useMemo(
    () => Array.from(new Set(tabLetters.map((item) => monthKey(item.sentAt)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [tabLetters],
  );

  const visible = useMemo(
    () => tabLetters.filter((item) => {
      const monthMatch = tab === "draft" || month === "all" || monthKey(item.sentAt) === month;
      const formatMatch = formatFilter === "all" || item.format === formatFilter;
      return monthMatch && formatMatch;
    }),
    [formatFilter, month, tab, tabLetters],
  );

  function roleLabel(key: MailboxPartnerKey) {
    return key === mePartnerKey ? "我" : "Ta";
  }

  function setActiveTab(value: Tab) {
    setTab(value);
    setMonth("all");
    setFormatFilter("all");
    setNotice(null);
    setError(null);
  }

  function openCreate() {
    if (!mePartnerKey || !taPartnerKey) return;
    setEditing(null);
    setLetterPages([""]);
    setEditorPage(0);
    setForm({
      senderKey: mePartnerKey,
      recipientKey: taPartnerKey,
      format: "letter",
      title: "",
      themeKey: "cream",
      body: "",
      status: "draft",
      sentAt: null,
    });
  }

  function openEdit(item: MailboxLetter) {
    if (!mePartnerKey || item.status !== "draft" || item.senderKey !== mePartnerKey) return;
    const pages = item.format === "letter" ? splitLetterPages(item.body) : [readableBody(item.body)];
    setReading(null);
    setEditing(item);
    setLetterPages(pages);
    setEditorPage(0);
    setForm({
      senderKey: item.senderKey,
      recipientKey: item.recipientKey,
      format: item.format,
      title: item.title,
      themeKey: item.themeKey,
      body: item.body,
      status: "draft",
      sentAt: null,
    });
  }

  function openRead(item: MailboxLetter) {
    setReaderPage(0);
    setReading(item);
  }

  function setFormat(format: MailboxFormat) {
    if (!form) return;
    if (format === "letter") {
      const pages = splitLetterPages(readableBody(form.body));
      setLetterPages(pages);
      setEditorPage(0);
      setForm({ ...form, format, body: bodyFromPages(pages) });
      return;
    }
    const plain = readableBody(form.body);
    setLetterPages([plain]);
    setEditorPage(0);
    setForm({ ...form, format, title: null, body: plain });
  }

  function updateLetterPage(value: string) {
    if (!form) return;
    const next = [...letterPages];
    next[editorPage] = value;
    setLetterPages(next);
    setForm({ ...form, body: bodyFromPages(next) });
  }

  function addLetterPage() {
    const next = [...letterPages, ""];
    setLetterPages(next);
    setEditorPage(next.length - 1);
    if (form) setForm({ ...form, body: bodyFromPages(next) });
  }

  function removeEmptyLetterPage() {
    if (letterPages.length <= 1 || letterPages[editorPage]?.trim()) return;
    const next = letterPages.filter((_, index) => index !== editorPage);
    setLetterPages(next);
    setEditorPage(Math.max(0, Math.min(editorPage, next.length - 1)));
    if (form) setForm({ ...form, body: bodyFromPages(next) });
  }

  function ownedForm() {
    if (!form || !mePartnerKey || !taPartnerKey) return null;
    const body = form.format === "letter" ? bodyFromPages(letterPages) : readableBody(form.body);
    return {
      ...form,
      senderKey: mePartnerKey,
      recipientKey: taPartnerKey,
      title: form.format === "letter" ? form.title : null,
      body,
      status: "draft" as const,
      sentAt: null,
    };
  }

  function validateDraft(payload: MailboxWritePayload) {
    if (!payload.body.replaceAll(PAGE_BREAK, "").trim()) {
      setError("还没有写内容");
      return false;
    }
    if (payload.format === "letter" && !(payload.title ?? "").trim()) {
      setError("手札需要一个标题");
      return false;
    }
    return true;
  }

  async function persist(mode: "draft" | "sent") {
    const payload = ownedForm();
    if (!payload || !validateDraft(payload)) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let saved: MailboxLetter;
      if (editing) {
        saved = await updateMailboxItem(editing.id, payload);
        if (mode === "sent") saved = await sendMailboxItem(editing.id);
      } else {
        saved = await createMailboxItem(payload, mode);
      }
      lettersQuery.update((current) => [
        saved,
        ...(current ?? []).filter((item) => item.id !== saved.id),
      ]);
      setEditing(undefined);
      setForm(null);
      setNotice(mode === "sent" ? "已经寄出，之后会保持只读。" : "已保存到待寄出。 ");
      setActiveTab(mode === "sent" ? "sent" : "draft");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : mode === "sent" ? "寄出失败" : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function sendDraft(item: MailboxLetter) {
    if (item.status !== "draft") return;
    if (!window.confirm("寄出后将不能再编辑，确认寄出吗？")) return;
    setBusyId(item.id);
    setError(null);
    try {
      const sent = await sendMailboxItem(item.id);
      lettersQuery.update((current) => [
        sent,
        ...(current ?? []).filter((row) => row.id !== item.id),
      ]);
      if (reading?.id === item.id) setReading(sent);
      setNotice("已经寄出，内容现在只读。 ");
      setActiveTab("sent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "寄出失败");
    } finally {
      setBusyId(null);
    }
  }

  async function removeDraft(item: MailboxLetter) {
    if (!mePartnerKey || item.status !== "draft" || item.senderKey !== mePartnerKey) return;
    if (!window.confirm("删除这份待寄出草稿吗？")) return;
    setBusyId(item.id);
    try {
      await deleteMailboxItem(item.id);
      lettersQuery.update((current) => (current ?? []).filter((row) => row.id !== item.id));
      if (reading?.id === item.id) setReading(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除草稿失败");
    } finally {
      setBusyId(null);
    }
  }

  if (!mePartnerKey || !taPartnerKey) {
    return (
      <AppPageShell title="小信箱" subtitle="正在确认当前账号…">
        <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">
          正在确认当前账号…
        </section>
      </AppPageShell>
    );
  }

  const readerPages = reading?.format === "letter" ? splitLetterPages(reading.body) : [];
  const activeReaderPage = Math.min(readerPage, Math.max(0, readerPages.length - 1));

  return (
    <>
      <AppPageShell
        title="小信箱"
        subtitle="写的时候慢一点，寄出去以后就让它好好待在那里。"
        actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}
      >
        <section className="life-surface life-section-card">
          <div className="grid grid-cols-3 gap-2">
            {([
              ["inbox", "收信箱"],
              ["sent", "已寄出"],
              ["draft", "待寄出"],
            ] as Array<[Tab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`rounded-[22px] border px-2 py-3 text-center transition ${
                  tab === value
                    ? "border-[var(--life-teal)] bg-white text-[var(--life-teal-strong)] shadow-[var(--life-shadow-soft)]"
                    : "border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] text-[var(--life-text-muted)]"
                }`}
              >
                <span className="mx-auto flex h-9 items-center justify-center"><MailboxTabIcon tab={value} /></span>
                <span className="mt-1 block text-xs font-black">{label}</span>
                <span className="mt-0.5 block text-[10px] font-bold opacity-70">{counts[value]} 封</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="mt-3 w-full rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white"
          >
            写给 Ta
          </button>

          <div className="life-mailbox-format-filter mt-3 grid grid-cols-3 gap-1 rounded-full bg-[var(--life-surface-soft)] p-1">
            {(["all", "letter", "postcard"] as FormatFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFormatFilter(value)}
                className={formatFilter === value ? "is-active" : ""}
              >
                {value === "all" ? "所有" : value === "letter" ? "手札" : "明信片"}
              </button>
            ))}
          </div>

          {tab !== "draft" ? (
            <div className="life-mailbox-filter mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-extrabold text-[var(--life-text)]">时间归档</p>
              <label className="relative shrink-0">
                <span className="sr-only">筛选月份</span>
                <select
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="life-mailbox-month-select appearance-none rounded-full border border-[var(--life-border-soft)] bg-white/80 py-2 pl-3 pr-8 text-xs font-extrabold text-[var(--life-teal-strong)] outline-none"
                >
                  <option value="all">全部月份</option>
                  {months.map((value) => <option key={value} value={value}>{monthText(value)}</option>)}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--life-teal-strong)]">⌄</span>
              </label>
            </div>
          ) : (
            <p className="mt-3 border-t border-[var(--life-border-soft)] pt-3 text-[10px] font-bold text-[var(--life-text-muted)]">
              待寄出按“最后编辑时间”排列；只有这里的内容可以继续修改。
            </p>
          )}
        </section>

        {visibleError ? (
          <div className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2.5 text-sm text-[var(--life-danger)]">
            {visibleError}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-3 rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2.5 text-xs font-bold text-[var(--life-teal-strong)]">
            {notice}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3">
          {!lettersQuery.loading && visible.length === 0 ? (
            <div className="life-surface life-section-card text-center">
              <div className="mx-auto flex h-12 w-16 items-center justify-center text-[var(--life-teal-strong)]"><MailboxTabIcon tab={tab} /></div>
              <p className="mt-2 text-sm font-bold text-[var(--life-text-body)]">
                {tab === "inbox" ? "收信箱还是空的" : tab === "sent" ? "还没有寄出的内容" : "没有待寄出的草稿"}
              </p>
            </div>
          ) : null}

          {visible.map((item) => {
            const timestamp = tab === "draft" ? item.updatedAt : item.sentAt;
            const timestampLabel = tab === "draft" ? "最后编辑" : tab === "inbox" ? "收到于" : "寄出于";
            return (
              <article
                key={item.id}
                className={`life-letter-preview ${item.format === "postcard" ? "is-postcard" : "is-letter"} ${themeClass(item.themeKey)}`}
              >
                <button type="button" className="life-letter-preview-main text-left" onClick={() => openRead(item)}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">
                      {roleLabel(item.senderKey)} → {roleLabel(item.recipientKey)} · {timestampLabel} {dateText(timestamp)}
                    </p>
                    <span className="life-letter-stamp">{item.format === "postcard" ? "明信片" : item.status === "draft" ? "草稿手札" : "手札"}</span>
                  </div>
                  {item.format === "letter" ? (
                    <>
                      <h2 className="mt-3 line-clamp-1 text-base font-black text-[var(--life-text)]">{item.title || "没有标题的手札"}</h2>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--life-text-body)]">{readableBody(item.body)}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-[10px] font-extrabold tracking-[0.14em] text-[var(--life-text-muted)]">POSTCARD</p>
                      <h2 className="mt-2 line-clamp-2 text-base font-black leading-6 text-[var(--life-text)]">{firstSentence(item.body)}</h2>
                    </>
                  )}
                  <span className="life-letter-read-hint">点开查看完整内容 <span aria-hidden>›</span></span>
                </button>

                {item.status === "draft" ? (
                  <div className="life-letter-preview-actions">
                    <button disabled={busyId === item.id} onClick={() => openEdit(item)}>编辑</button>
                    <button disabled={busyId === item.id} onClick={() => void sendDraft(item)}>寄出</button>
                    <button disabled={busyId === item.id} onClick={() => void removeDraft(item)}>删除</button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </AppPageShell>

      {reading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3" onMouseDown={() => setReading(null)}>
          {reading.format === "postcard" ? (
            <article
              className={`island-life-v2 ${themeClass(reading.themeKey)} relative aspect-[1.62/1] w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-[var(--life-surface)] p-5 shadow-[var(--life-shadow-float)] sm:p-7`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black tracking-[0.16em] text-[var(--life-text-muted)]">POSTCARD</p>
                    <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">
                      {roleLabel(reading.senderKey)} → {roleLabel(reading.recipientKey)} · {reading.status === "draft" ? `最后编辑 ${dateText(reading.updatedAt)}` : `寄出于 ${dateText(reading.sentAt)}`}
                    </p>
                  </div>
                  <button type="button" onClick={() => setReading(null)} className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-extrabold text-[var(--life-text-body)]">关闭</button>
                </div>
                <div className="my-auto grid grid-cols-[1fr_auto] items-stretch gap-5">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-[var(--life-text-body)] sm:text-base sm:leading-8">{readableBody(reading.body)}</p>
                  <div className="w-px bg-[var(--life-border-soft)]" />
                </div>
                {reading.status === "draft" ? (
                  <div className="flex gap-4 text-xs font-extrabold text-[var(--life-teal-strong)]">
                    <button onClick={() => openEdit(reading)}>编辑草稿</button>
                    <button onClick={() => void sendDraft(reading)}>寄出</button>
                  </div>
                ) : null}
              </div>
            </article>
          ) : (
            <article
              className={`island-life-v2 life-letter-reader ${themeClass(reading.themeKey)}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold text-[var(--life-text-muted)]">{roleLabel(reading.senderKey)} 写给 {roleLabel(reading.recipientKey)}</p>
                  <p className="mt-1 text-[10px] text-[var(--life-text-muted)]">
                    {reading.status === "draft" ? `最后编辑 ${dateText(reading.updatedAt)}` : `寄出于 ${dateText(reading.sentAt)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setReading(null)} className="rounded-full bg-white/60 px-3 py-1.5 text-xs font-extrabold text-[var(--life-text-body)]">关闭</button>
              </div>

              <h2 className="mt-5 text-xl font-black text-[var(--life-text)]">{reading.title || "没有标题的手札"}</h2>
              <div className="life-letter-reader-body mt-5 min-h-[19rem] whitespace-pre-wrap text-sm leading-8 text-[var(--life-text-body)]">
                {readerPages[activeReaderPage]}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--life-border-soft)] pt-3">
                <button
                  type="button"
                  disabled={activeReaderPage === 0}
                  onClick={() => setReaderPage((value) => Math.max(0, value - 1))}
                  className="text-xs font-extrabold text-[var(--life-teal-strong)] disabled:opacity-30"
                >
                  ← 上一页
                </button>
                <span className="text-[10px] font-bold text-[var(--life-text-muted)]">第 {activeReaderPage + 1} / {readerPages.length} 页</span>
                <button
                  type="button"
                  disabled={activeReaderPage >= readerPages.length - 1}
                  onClick={() => setReaderPage((value) => Math.min(readerPages.length - 1, value + 1))}
                  className="text-xs font-extrabold text-[var(--life-teal-strong)] disabled:opacity-30"
                >
                  下一页 →
                </button>
              </div>

              {reading.status === "draft" ? (
                <div className="mt-4 flex gap-4 text-xs font-extrabold text-[var(--life-teal-strong)]">
                  <button type="button" onClick={() => openEdit(reading)}>编辑草稿</button>
                  <button type="button" onClick={() => void sendDraft(reading)}>寄出</button>
                </div>
              ) : null}
            </article>
          )}
        </div>
      ) : null}

      {editing !== undefined && form ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-3 sm:items-center">
          <div className="island-life-v2 max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-[var(--life-surface)] p-4 shadow-[var(--life-shadow-float)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">{editing ? "编辑待寄出" : "写给 Ta"}</h2>
                <p className="mt-1 text-[10px] font-bold text-[var(--life-text-muted)]">寄出以后将变成只读，不能再修改。</p>
              </div>
              <button onClick={() => { setEditing(undefined); setForm(null); }} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-sm">关闭</button>
            </div>

            <div className="mt-4 grid gap-3">
              <p className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--life-text-body)]">我 → Ta</p>

              <div>
                <p className="mb-1 text-xs font-bold">样式</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormat("letter")} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "letter" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>手札</button>
                  <button type="button" onClick={() => setFormat("postcard")} className={`rounded-2xl border px-3 py-3 text-sm font-bold ${form.format === "postcard" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border)]"}`}>明信片</button>
                </div>
              </div>

              {form.format === "letter" ? (
                <label className="text-xs font-bold">
                  标题
                  <input
                    value={form.title ?? ""}
                    maxLength={120}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="给这份手札起个名字"
                    className="mt-1 w-full rounded-2xl border border-[var(--life-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--life-teal)]"
                  />
                </label>
              ) : null}

              <div>
                <p className="mb-1 text-xs font-bold">纸张主题</p>
                <div className="grid grid-cols-4 gap-2">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.key}
                      type="button"
                      onClick={() => setForm({ ...form, themeKey: theme.key })}
                      className={`life-mail-theme-choice ${form.themeKey === theme.key ? "is-active" : ""}`}
                    >
                      <span>{theme.swatch}</span><small>{theme.label}</small>
                    </button>
                  ))}
                </div>
              </div>

              {form.format === "letter" ? (
                <div className={`rounded-[26px] border border-[var(--life-border-soft)] bg-white/80 p-3 ${themeClass(form.themeKey ?? "cream")}`}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <button type="button" disabled={editorPage === 0} onClick={() => setEditorPage((value) => Math.max(0, value - 1))} className="text-xs font-extrabold text-[var(--life-teal-strong)] disabled:opacity-30">← 上一页</button>
                    <span className="text-[10px] font-bold text-[var(--life-text-muted)]">信纸 {editorPage + 1} / {letterPages.length}</span>
                    <button type="button" disabled={editorPage >= letterPages.length - 1} onClick={() => setEditorPage((value) => Math.min(letterPages.length - 1, value + 1))} className="text-xs font-extrabold text-[var(--life-teal-strong)] disabled:opacity-30">下一页 →</button>
                  </div>
                  <textarea
                    autoFocus
                    value={letterPages[editorPage] ?? ""}
                    maxLength={LETTER_PAGE_CHARS}
                    onChange={(event) => updateLetterPage(event.target.value)}
                    rows={12}
                    placeholder="这一页想写什么…"
                    className="life-letter-reader-body w-full resize-none bg-transparent px-2 py-2 text-sm leading-8 text-[var(--life-text-body)] outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-[var(--life-text-muted)]">{(letterPages[editorPage] ?? "").length}/{LETTER_PAGE_CHARS}</span>
                    <div className="flex gap-3 text-[10px] font-extrabold text-[var(--life-teal-strong)]">
                      <button type="button" onClick={addLetterPage}>＋ 新一页</button>
                      {letterPages.length > 1 && !(letterPages[editorPage] ?? "").trim() ? <button type="button" onClick={removeEmptyLetterPage}>删除空页</button> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`aspect-[1.62/1] rounded-[26px] border border-[var(--life-border-soft)] bg-white/80 p-4 ${themeClass(form.themeKey ?? "cream")}`}>
                  <p className="text-[10px] font-black tracking-[0.16em] text-[var(--life-text-muted)]">POSTCARD</p>
                  <textarea
                    autoFocus
                    value={readableBody(form.body)}
                    maxLength={800}
                    onChange={(event) => setForm({ ...form, body: event.target.value })}
                    placeholder="把一句想说的话写在明信片上…"
                    className="mt-3 h-[calc(100%-2rem)] w-full resize-none bg-transparent text-sm leading-7 text-[var(--life-text-body)] outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={saving}
                  onClick={() => void persist("draft")}
                  className="rounded-2xl border border-[var(--life-teal)] bg-white px-4 py-3 text-sm font-extrabold text-[var(--life-teal-strong)] disabled:opacity-50"
                >
                  {saving ? "处理中…" : "保存到待寄出"}
                </button>
                <button
                  disabled={saving}
                  onClick={() => void persist("sent")}
                  className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {saving ? "处理中…" : "确认寄出"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
