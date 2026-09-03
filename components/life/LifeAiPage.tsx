"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  operations?: Array<{ tool: string; ok: boolean; summary: string }>;
};

type AiResponse = {
  ok?: boolean;
  reply?: string;
  error?: string;
  operations?: Array<{ tool: string; ok: boolean; summary: string }>;
};

function messageId() {
  return crypto.randomUUID();
}

export function LifeAiPage() {
  const { authenticated, currentPartnerKey, loading } = useLifeIdentity();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "我可以直接查询和维护岛屿生活里的真实记录。你可以问“药箱还有什么”“我今天吃了什么”，也可以说“把今天体重记成 52.4”“这张照片是午饭，帮我记上”。",
    },
  ]);
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const imageLabel = useMemo(() => {
    if (!image) return "";
    const kb = Math.max(1, Math.round(image.size / 1024));
    return `${image.name || "图片"} · ${kb} KB`;
  }, [image]);

  async function sendMessage() {
    const message = text.trim();
    if ((!message && !image) || sending) return;

    const existingHistory = messages
      .filter((item) => item.id !== "welcome")
      .slice(-12)
      .map((item) => ({ role: item.role, content: item.content }));

    const displayText = message || "请看看这张图片。";
    const userMessage: ChatMessage = {
      id: messageId(),
      role: "user",
      content: image ? `${displayText}\n[已附图片：${image.name || "图片"}]` : displayText,
    };
    setMessages((current) => [...current, userMessage]);
    setText("");
    setSending(true);

    try {
      const form = new FormData();
      form.set("message", message);
      form.set("history", JSON.stringify(existingHistory));
      if (image) form.set("image", image);

      const response = await fetch("/api/ai/chat", { method: "POST", body: form });
      const body = (await response.json().catch(() => null)) as AiResponse | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.error || "AI 请求失败");
      }
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          content: body.reply?.trim() || "已完成。",
          operations: body.operations,
        },
      ]);
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: messageId(),
          role: "assistant",
          content: `这次没有执行成功：${error instanceof Error ? error.message : "未知错误"}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell title="AI 助手" subtitle="正在确认当前账号…">
        <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">加载中…</section>
      </AppPageShell>
    );
  }

  if (!authenticated || !currentPartnerKey) {
    return (
      <AppPageShell title="AI 助手" subtitle="AI 会沿用你的生活账号权限。">
        <section className="life-surface life-section-card">
          <p className="text-sm font-extrabold">请先登录</p>
          <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">登录后 AI 才能知道当前是 cat 还是 fish，并按同样的权限查询和修改数据。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-5 py-2.5 text-sm font-black text-white">去登录</Link>
        </section>
      </AppPageShell>
    );
  }

  return (
    <AppPageShell
      title="AI 助手"
      subtitle={`当前身份：${currentPartnerKey === "cat" ? "猫猫" : "鱼鱼"}。查询读真实数据，修改直接写回云端。`}
      actions={<Link href="/me" className="rounded-full bg-white/75 px-3 py-2 text-xs font-extrabold text-[var(--life-teal-strong)]">返回</Link>}
    >
      <section className="grid gap-3 pb-32">
        {messages.map((item) => (
          <div key={item.id} className={item.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                item.role === "user"
                  ? "max-w-[86%] rounded-[22px] rounded-br-md bg-[var(--life-teal)] px-4 py-3 text-sm leading-6 text-white shadow-sm"
                  : "life-surface max-w-[92%] rounded-[22px] rounded-bl-md px-4 py-3 text-sm leading-6 text-[var(--life-text)]"
              }
            >
              <p className="whitespace-pre-wrap break-words">{item.content}</p>
              {item.role === "assistant" && item.operations?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[var(--life-border-soft)] pt-2">
                  {item.operations.map((operation, index) => (
                    <span
                      key={`${item.id}-${index}`}
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${operation.ok ? "bg-[var(--life-surface-soft)] text-[var(--life-teal-strong)]" : "bg-red-50 text-red-600"}`}
                    >
                      {operation.ok ? "✓" : "!"} {operation.summary}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex justify-start">
            <div className="life-surface rounded-[22px] rounded-bl-md px-4 py-3 text-sm text-[var(--life-text-muted)]">正在查询 / 执行…</div>
          </div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-4">
        <div className="mx-auto w-full max-w-[30rem] rounded-[24px] border border-[var(--life-border-soft)] bg-white/95 p-3 shadow-lg backdrop-blur">
          {image ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-[var(--life-surface-soft)] px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-bold text-[var(--life-text)]">📷 {imageLabel}</span>
              <button type="button" onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }} className="shrink-0 font-black text-[var(--life-danger)]">移除</button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
            <button type="button" aria-label="选择图片" onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--life-surface-soft)] text-lg">📷</button>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              placeholder="问记录，或直接说要怎么改…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-[var(--life-border-soft)] bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:border-[var(--life-teal)]"
            />
            <button
              type="button"
              disabled={sending || (!text.trim() && !image)}
              onClick={() => void sendMessage()}
              className="h-11 shrink-0 rounded-full bg-[var(--life-teal)] px-4 text-sm font-black text-white disabled:opacity-40"
            >
              发送
            </button>
          </div>
          <p className="mt-2 px-1 text-[10px] leading-4 text-[var(--life-text-muted)]">删除需要你明确说“删除/删掉”。旧游戏全量覆盖需要明确说“确认覆盖游戏数据”。</p>
        </div>
      </div>
    </AppPageShell>
  );
}
