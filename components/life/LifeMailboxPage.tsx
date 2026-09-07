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

type MailboxGroup = {
  month: string;
  items: MailboxLetter[];
};

const EMPTY_LETTERS: MailboxLetter[] = [];
const PAGE_BREAK = "\n\f\n";
const LETTER_PAGE_CHARS = 460;
const THEME_KEYS = ["cream", "forest", "sea", "sunset"] as const;

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
  const date = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d).replaceAll("/", ".");
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

function firstSentence(value: string) {
  const text = value.replaceAll(PAGE_BREAK, "\n").trim().replace(/\s+/g, " ");
  const match = text.match(/^.*?[。！？.!?](?:\s|$)/);
  return (match?.[0] ?? text).trim();
}

function themeClass(themeKey: string) {
  return THEME_KEYS.some((theme) => theme === themeKey)
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
      <svg viewBox="0 0 58 46" className="life-mailbox-tab-art" fill="none" aria-hidden>
        <path d="M10 31 45 11 36 37 27 29 10 31Z" fill="#fff9ed" stroke="#8f755d" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="m27 29 18-18" stroke="#8f755d" strokeWidth="1.4" strokeLinecap="round" />
        <path d="m17 33-4 5m9-4-2 6" stroke="#c79c67" strokeWidth="1.3" strokeLinecap="round" strokeDasharray="2 2" />
        <path d="M7 39c4-4 7-5 11-4-2 4-5 6-11 4Z" fill="#a9c48f" stroke="#78916b" strokeWidth="1" />
      </svg>
    );
  }
  if (tab === "draft") {
    return (
      <svg viewBox="0 0 58 46" className="life-mailbox-tab-art" fill="none" aria-hidden>
        <rect x="13" y="7" width="27" height="31" rx="3" fill="#fffaf0" stroke="#8f755d" strokeWidth="1.4" />
        <path d="M18 14h16M18 20h16M18 26h12" stroke="#d3bd9b" strokeWidth="1.2" strokeLinecap="round" />
        <path d="m34 31 11-11 4 4-11 11-6 2 2-6Z" fill="#efb37b" stroke="#8f755d" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8 40c4-6 7-8 12-7-1 5-5 8-12 7Z" fill="#a8c78f" stroke="#78916b" strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 58 46" className="life-mailbox-tab-art" fill="none" aria-hidden>
      <path d="M15 16h30v23H15z" fill="#fff7e7" stroke="#8f755d" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m15 18 15 12 15-12" stroke="#c68255" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M24 16v-6h12v6" stroke="#8f755d" strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="30" cy="11" r="2.2" fill="#e88c59" />
      <path d="M8 39c2-7 6-11 11-12 1 6-2 11-11 12Z" fill="#abc793" stroke="#78916b" strokeWidth="1" />
      <path d="M48 38c-1-5 1-8 5-11 2 5 1 9-5 11Z" fill="#b9cf9f" stroke="#78916b" strokeWidth="1" />
    </svg>
  );
}

function MailboxPreviewArt({ format, draft }: { format: MailboxFormat; draft: boolean }) {
  if (format === "postcard") {
    return (
      <svg viewBox="0 0 64 52" className="life-mailbox-preview-svg" fill="none" aria-hidden>
        <rect x="6" y="8" width="52" height="36" rx="4" fill="#fffaf0" stroke="#d7b68f" strokeWidth="1.2" />
        <path d="M7 35c9-11 15-11 23-2 6-8 13-8 27 1v9H7v-8Z" fill="#aed6d2" />
        <path d="M7 37c10-7 17-7 25 0 7-5 14-5 25 0" stroke="#6aa1a5" strokeWidth="1.2" />
        <circle cx="46" cy="17" r="5" fill="#f5d59a" />
        <path d="M13 17h14M13 21h11" stroke="#d4b18d" strokeWidth="1" strokeLinecap="round" />
        {draft ? <path d="m43 38 8-8 3 3-8 8-5 1 2-4Z" fill="#ef9d67" stroke="#9b6f55" strokeWidth="1" /> : null}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 52" className="life-mailbox-preview-svg" fill="none" aria-hidden>
      <rect x="15" y="5" width="35" height="42" rx="3" fill="#fffaf0" stroke="#d7b68f" strokeWidth="1.2" />
      <path d="M21 14h22M21 19h22M21 24h18M21 29h20M21 34h15" stroke="#d9c5a7" strokeWidth="1" strokeLinecap="round" />
      <path d="M13 9c5 2 8 5 9 9-5 0-8-3-9-9Z" fill="#e9b38e" />
      <path d="M46 38c4-1 7 1 9 5-5 1-8-1-9-5Z" fill="#9dbb82" />
      {draft ? <path d="m40 38 9-9 3 3-9 9-5 1 2-4Z" fill="#ef9d67" stroke="#9b6f55" strokeWidth="1" /> : null}
    </svg>
  );
}

function LetterCornerArt({ position }: { position: "top" | "bottom" }) {
  return (
    <svg
      viewBox="0 0 130 80"
      className={`life-letter-corner-art is-${position}`}
      fill="none"
      aria-hidden
    >
      <path d="M4 65c24-12 29-29 34-56" stroke="#78916b" strokeWidth="2" strokeLinecap="round" />
      <path d="M23 42c-12 0-18-6-20-15 11-2 19 3 20 15ZM29 31c1-12 7-19 17-21 2 11-4 19-17 21Z" fill="#a8c58d" />
      <path d="M44 57c16-7 33-8 49-2" stroke="#b98a69" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="52" cy="55" r="6" fill="#efb491" />
      <circle cx="63" cy="51" r="5" fill="#f3c4a6" />
      <circle cx="74" cy="55" r="5.5" fill="#e9ad88" />
      <path d="M89 56c9-11 18-15 30-15-3 10-11 16-30 15Z" fill="#c3d4a7" />
    </svg>
  );
}

function PostcardSceneArt() {
  return (
    <svg viewBox="0 0 180 92" className="life-postcard-scene" fill="none" aria-hidden>
      <path d="M0 72c28-22 47-24 68-8 22-28 50-31 88 2l24 12v14H0V72Z" fill="#b7d9d0" />
      <path d="M0 78c38-13 67-12 94 1 31-15 59-14 86 2v11H0V78Z" fill="#91c7ce" />
      <path d="M12 85c36-8 72-8 108 0 18-5 38-5 60 0" stroke="#fff7e9" strokeWidth="2" />
      <path d="m102 62 17 12H86l16-12Z" fill="#f2dfba" stroke="#9a7d63" strokeWidth="1" />
      <path d="M102 44v19" stroke="#9a7d63" strokeWidth="1.3" />
      <path d="m103 45 14 8h-14V45Z" fill="#e48d65" />
      <circle cx="151" cy="22" r="10" fill="#f3d79d" opacity=".9" />
      <path d="M16 24c14-8 26-8 39 0" stroke="#c6dfe2" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function PostcardStamp() {
  return (
    <div className="life-postcard-stamp" aria-hidden>
      <span className="life-postcard-postmark" />
      <svg viewBox="0 0 48 58" fill="none">
        <path d="M4 4h40v50H4z" fill="#d9edf0" stroke="#8ba9a7" strokeWidth="1.2" />
        <path d="M8 42c8-10 15-12 22-4 5-6 9-6 10-4v15H8v-7Z" fill="#94c9ca" />
        <circle cx="34" cy="15" r="6" fill="#f2d59b" />
      </svg>
    </div>
  );
}

export function LifeMailboxPage() {
  const { mePartnerKey, taPartnerKey } = useLifeIdentity();
  const [tab, setTab] = useState<Tab>("inbox");
  const [month, setMonth] = useState("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
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

  const tabLetters = useMemo(() => {
    if (!mePartnerKey) return [];
    if (tab === "draft") {
      return letters
        .filter((item) => item.status === "draft" && item.senderKey === mePartnerKey)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    if (tab === "sent") {
      return letters
        .filter((item) => item.status === "sent" && item.senderKey === mePartnerKey)
        .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
    }
    return letters
      .filter((item) => item.status === "sent" && item.recipientKey === mePartnerKey)
      .sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  }, [letters, mePartnerKey, tab]);

  const months = useMemo(
    () => Array.from(new Set(tabLetters.map((item) => monthKey(item.sentAt)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [tabLetters],
  );

  const monthCounts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of tabLetters) {
      const key = monthKey(item.sentAt);
      if (!key) continue;
      result.set(key, (result.get(key) ?? 0) + 1);
    }
    return result;
  }, [tabLetters]);

  const visible = useMemo(
    () => tabLetters.filter((item) => {
      const monthMatch = tab === "draft" || month === "all" || monthKey(item.sentAt) === month;
      const formatMatch = formatFilter === "all" || item.format === formatFilter;
      return monthMatch && formatMatch;
    }),
    [formatFilter, month, tab, tabLetters],
  );

  const groupedVisible = useMemo<MailboxGroup[]>(() => {
    if (tab === "draft") return [];
    const groups: MailboxGroup[] = [];
    for (const item of visible) {
      const key = monthKey(item.sentAt);
      const existing = groups.find((group) => group.month === key);
      if (existing) existing.items.push(item);
      else groups.push({ month: key, items: [item] });
    }
    return groups;
  }, [tab, visible]);

  function roleLabel(key: MailboxPartnerKey) {
    return key === mePartnerKey ? "我" : "Ta";
  }

  function setActiveTab(value: Tab) {
    setTab(value);
    setMonth("all");
    setFormatFilter("all");
    setMonthPickerOpen(false);
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
      setNotice(mode === "sent" ? "已经寄出，之后会保持只读。" : "已保存到待寄出。");
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
      setNotice("已经寄出，内容现在只读。");
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

  function renderPreview(item: MailboxLetter) {
    const timestamp = tab === "draft" ? item.updatedAt : item.sentAt;
    const timestampLabel = tab === "draft" ? "最后编辑" : tab === "inbox" ? "来自 Ta" : "寄给 Ta";
    return (
      <article
        key={item.id}
        className={`life-letter-preview ${item.format === "postcard" ? "is-postcard" : "is-letter"} ${themeClass(item.themeKey)}`}
      >
        <button type="button" className="life-letter-preview-main" onClick={() => openRead(item)}>
          <span className="life-mailbox-preview-thumb">
            <MailboxPreviewArt format={item.format} draft={item.status === "draft"} />
          </span>
          <span className="life-mailbox-preview-copy">
            <strong>{item.format === "letter" ? (item.title || "没有标题的手札") : firstSentence(item.body)}</strong>
            <span className="life-mailbox-preview-meta">
              <em className={item.format === "postcard" ? "is-postcard" : item.status === "draft" ? "is-draft" : "is-letter"}>
                {item.format === "postcard" ? "明信片" : item.status === "draft" ? "待寄出" : "手札"}
              </em>
              <span>{timestampLabel}</span>
              <time>{dateText(timestamp)}</time>
            </span>
          </span>
          <span className="life-mailbox-preview-chevron" aria-hidden>›</span>
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
        title={(
          <span className="life-mailbox-header-title">
            <Link href="/nest" className="life-mailbox-back" aria-label="返回小窝">‹</Link>
            <span>小信箱</span>
          </span>
        )}
        actions={(
          <button type="button" onClick={openCreate} className="life-mailbox-compose-top" aria-label="写给 Ta">
            <svg viewBox="0 0 28 28" fill="none" aria-hidden>
              <path d="M6 8h13v13H6z" stroke="currentColor" strokeWidth="1.6" />
              <path d="m15 14 7-7 2 2-7 7-4 1 2-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      >
        <section className="life-mailbox-toolbar-v3">
          <div className="life-mailbox-tabs-v3">
            {([
              ["inbox", "收信箱"],
              ["sent", "已寄出"],
              ["draft", "待寄出"],
            ] as Array<[Tab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={tab === value ? "is-active" : ""}
              >
                <MailboxTabIcon tab={value} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="life-mailbox-controls-v3">
            <div className="life-mailbox-format-filter">
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
              <button type="button" className="life-mailbox-month-trigger" onClick={() => setMonthPickerOpen(true)}>
                {month === "all" ? "全部月份" : monthText(month)}
                <span aria-hidden>⌄</span>
              </button>
            ) : (
              <span className="life-mailbox-draft-note">按最后编辑时间排列</span>
            )}
          </div>
        </section>

        {visibleError ? (
          <div className="life-mailbox-feedback is-error">{visibleError}</div>
        ) : null}
        {notice ? (
          <div className="life-mailbox-feedback">{notice}</div>
        ) : null}

        <div className="life-mailbox-list-v3">
          {!lettersQuery.loading && visible.length === 0 ? (
            <div className="life-mailbox-empty-v3">
              <MailboxTabIcon tab={tab} />
              <p>{tab === "inbox" ? "收信箱还是空的" : tab === "sent" ? "还没有寄出的内容" : "没有待寄出的草稿"}</p>
              <button type="button" onClick={openCreate}>写一封给 Ta</button>
            </div>
          ) : null}

          {tab === "draft" && visible.length > 0 ? (
            <section className="life-mailbox-month-group">
              <h2>还没寄出的信</h2>
              <div>{visible.map(renderPreview)}</div>
            </section>
          ) : null}

          {tab !== "draft" ? groupedVisible.map((group) => (
            <section key={group.month} className="life-mailbox-month-group">
              <h2>{monthText(group.month)}</h2>
              <div>{group.items.map(renderPreview)}</div>
            </section>
          )) : null}
        </div>
      </AppPageShell>

      {monthPickerOpen && tab !== "draft" ? (
        <div className="life-mailbox-picker-backdrop" onMouseDown={() => setMonthPickerOpen(false)}>
          <div className="life-mailbox-month-sheet" onMouseDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              className={month === "all" ? "is-selected" : ""}
              onClick={() => { setMonth("all"); setMonthPickerOpen(false); }}
            >
              <span>全部月份</span>
              {month === "all" ? <strong>✓</strong> : null}
            </button>
            {months.map((value) => (
              <button
                key={value}
                type="button"
                className={month === value ? "is-selected" : ""}
                onClick={() => { setMonth(value); setMonthPickerOpen(false); }}
              >
                <span>{monthText(value)} <small>({monthCounts.get(value) ?? 0})</small></span>
                {month === value ? <strong>✓</strong> : null}
              </button>
            ))}
            <button type="button" className="is-cancel" onClick={() => setMonthPickerOpen(false)}>取消</button>
          </div>
        </div>
      ) : null}

      {reading ? (
        <div className="life-mailbox-reader-backdrop" onMouseDown={() => setReading(null)}>
          <button
            type="button"
            className="life-mailbox-reader-close"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setReading(null)}
            aria-label="关闭"
          >
            ×
          </button>

          {reading.format === "postcard" ? (
            <article
              className={`island-life-v2 life-postcard-modal ${themeClass(reading.themeKey)}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="life-postcard-message-side">
                <p className="life-postcard-kicker">POSTCARD</p>
                <p className="life-postcard-meta">
                  {roleLabel(reading.senderKey)} → {roleLabel(reading.recipientKey)} · {reading.status === "draft" ? `最后编辑 ${dateText(reading.updatedAt)}` : `寄出于 ${dateText(reading.sentAt)}`}
                </p>
                <p className="life-postcard-message">{readableBody(reading.body)}</p>
                <PostcardSceneArt />
              </div>
              <div className="life-postcard-address-side">
                <PostcardStamp />
                <div className="life-postcard-address-lines" aria-hidden>
                  <span /><span /><span />
                </div>
                <p>TO · {roleLabel(reading.recipientKey)}</p>
              </div>
              {reading.status === "draft" ? (
                <div className="life-postcard-draft-actions">
                  <button onClick={() => openEdit(reading)}>编辑草稿</button>
                  <button onClick={() => void sendDraft(reading)}>寄出</button>
                </div>
              ) : null}
            </article>
          ) : (
            <article
              className={`island-life-v2 life-letter-reader life-letter-paper-modal ${themeClass(reading.themeKey)}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <LetterCornerArt position="top" />
              <LetterCornerArt position="bottom" />
              <header className="life-letter-paper-header">
                <h2>{reading.title || "没有标题的手札"}</h2>
                <p>{dateText(reading.status === "draft" ? reading.updatedAt : reading.sentAt)} · {roleLabel(reading.senderKey)} 写给 {roleLabel(reading.recipientKey)}</p>
              </header>
              <div className="life-letter-reader-body life-letter-paper-body">
                {readerPages[activeReaderPage]}
              </div>
              <footer className="life-letter-page-footer">
                <button
                  type="button"
                  disabled={activeReaderPage === 0}
                  onClick={() => setReaderPage((value) => Math.max(0, value - 1))}
                  aria-label="上一页"
                >
                  ‹
                </button>
                <span>{activeReaderPage + 1} / {readerPages.length}</span>
                <button
                  type="button"
                  disabled={activeReaderPage >= readerPages.length - 1}
                  onClick={() => setReaderPage((value) => Math.min(readerPages.length - 1, value + 1))}
                  aria-label="下一页"
                >
                  ›
                </button>
              </footer>
              {reading.status === "draft" ? (
                <div className="life-letter-draft-actions">
                  <button type="button" onClick={() => openEdit(reading)}>编辑草稿</button>
                  <button type="button" onClick={() => void sendDraft(reading)}>寄出</button>
                </div>
              ) : null}
            </article>
          )}
        </div>
      ) : null}

      {editing !== undefined && form ? (
        <div className="life-mailbox-editor-backdrop">
          <div className="island-life-v2 life-mailbox-editor-panel">
            <header className="life-mailbox-editor-header">
              <button
                type="button"
                className="life-mailbox-editor-close"
                onClick={() => { setEditing(undefined); setForm(null); }}
                aria-label="关闭"
              >
                ×
              </button>
              <strong>{editing ? "编辑待寄出" : "写给 Ta"}</strong>
              <button type="button" className="life-mailbox-editor-done" disabled={saving} onClick={() => void persist("draft")}>完成</button>
            </header>

            <div className="life-mailbox-editor-type-switch">
              <button type="button" onClick={() => setFormat("letter")} className={form.format === "letter" ? "is-active" : ""}>手札</button>
              <button type="button" onClick={() => setFormat("postcard")} className={form.format === "postcard" ? "is-active" : ""}>明信片</button>
            </div>

            {form.format === "letter" ? (
              <>
                <div className={`life-letter-reader life-letter-compose-paper ${themeClass(form.themeKey ?? "cream")}`}>
                  <LetterCornerArt position="top" />
                  <LetterCornerArt position="bottom" />
                  <input
                    value={form.title ?? ""}
                    maxLength={120}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="给这份手札起个名字"
                    className="life-letter-compose-title"
                  />
                  <p className="life-letter-compose-meta">写给 Ta · 第 {editorPage + 1} 页</p>
                  <textarea
                    autoFocus
                    value={letterPages[editorPage] ?? ""}
                    maxLength={LETTER_PAGE_CHARS}
                    onChange={(event) => updateLetterPage(event.target.value)}
                    rows={12}
                    placeholder="在这里写下想对 Ta 说的话……"
                    className="life-letter-reader-body life-letter-compose-textarea"
                  />
                  <div className="life-letter-page-footer is-editor">
                    <button type="button" disabled={editorPage === 0} onClick={() => setEditorPage((value) => Math.max(0, value - 1))}>‹</button>
                    <span>{editorPage + 1} / {letterPages.length}</span>
                    <button type="button" disabled={editorPage >= letterPages.length - 1} onClick={() => setEditorPage((value) => Math.min(letterPages.length - 1, value + 1))}>›</button>
                  </div>
                </div>
                <div className="life-letter-editor-page-tools">
                  <button type="button" onClick={addLetterPage}>＋ 添加一页</button>
                  {letterPages.length > 1 && !(letterPages[editorPage] ?? "").trim() ? <button type="button" onClick={removeEmptyLetterPage}>删除空页</button> : <span />}
                  <small>{(letterPages[editorPage] ?? "").length}/{LETTER_PAGE_CHARS}</small>
                </div>
              </>
            ) : (
              <div className={`life-postcard-compose ${themeClass(form.themeKey ?? "cream")}`}>
                <div className="life-postcard-message-side">
                  <p className="life-postcard-kicker">POSTCARD</p>
                  <textarea
                    autoFocus
                    value={readableBody(form.body)}
                    maxLength={800}
                    onChange={(event) => setForm({ ...form, body: event.target.value })}
                    placeholder="把一句想说的话写在明信片上……"
                    className="life-postcard-compose-textarea"
                  />
                  <PostcardSceneArt />
                </div>
                <div className="life-postcard-address-side">
                  <PostcardStamp />
                  <div className="life-postcard-address-lines" aria-hidden><span /><span /><span /></div>
                  <p>TO · Ta</p>
                </div>
              </div>
            )}

            <div className="life-mailbox-editor-actions">
              <button disabled={saving} onClick={() => { setEditing(undefined); setForm(null); }}>取消</button>
              <button disabled={saving} onClick={() => void persist("draft")}>{saving ? "处理中…" : "保存草稿"}</button>
              <button disabled={saving} className="is-send" onClick={() => void persist("sent")}>{saving ? "处理中…" : "寄出"}</button>
            </div>
            <p className="life-mailbox-editor-lock-note">寄出后内容会永久保持只读，不能再编辑。</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
