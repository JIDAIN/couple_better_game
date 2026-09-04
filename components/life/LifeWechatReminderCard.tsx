"use client";

import { useEffect, useState } from "react";
import type { LifePartnerKey } from "@/lib/life/life-service";

type ApiStatus = {
  ok?: boolean;
  configured?: boolean;
  error?: string;
};

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiStatus | null;
  return body?.error || "操作失败，请稍后再试";
}

export function LifeWechatReminderCard({ actor }: { actor: LifePartnerKey }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const accountName = actor === "cat" ? "小猫" : "小鱼";
  const aiName = actor === "cat" ? "团子" : "仔仔";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/life/notifications/pushplus", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as ApiStatus;
      })
      .then((body) => {
        if (!cancelled) setConfigured(body.configured === true);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setConfigured(false);
          setError(reason instanceof Error ? reason.message : "读取微信提醒状态失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [actor]);

  async function save() {
    const value = token.trim();
    if (value.length < 10) {
      setError("请输入 PushPlus token");
      return;
    }
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/life/notifications/pushplus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: value }),
      });
      if (!response.ok) throw new Error(await readError(response));
      setConfigured(true);
      setToken("");
      setNotice(`${accountName}的微信提醒已保存，可以发送测试消息了。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/life/notifications/pushplus", { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      setNotice(`测试消息已交给 PushPlus，请查看${accountName}绑定的微信。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "测试发送失败");
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    setBusy("clear");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/life/notifications/pushplus", { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      setConfigured(false);
      setToken("");
      setNotice(`${accountName}的微信提醒已解绑。`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "解绑失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="life-surface rounded-[var(--life-radius-card)] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[var(--life-surface-soft)] text-lg" aria-hidden>🔔</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[var(--life-text)]">微信提醒</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">{aiName}只会提醒当前账号，不会发到 Ta 的微信。</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold text-[var(--life-text-muted)]">
              {configured === null ? "读取中" : configured ? "已绑定" : "未绑定"}
            </span>
          </div>

          <div className="mt-4 grid gap-2.5">
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={configured ? "输入新 token 可替换当前绑定" : "粘贴 PushPlus token"}
              className="w-full rounded-2xl border border-[var(--life-border-soft)] bg-white/80 px-3.5 py-3 text-sm outline-none focus:border-[var(--life-teal)]"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void save()}
                className="rounded-full bg-[var(--life-teal)] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
              >
                {busy === "save" ? "保存中…" : configured ? "替换 token" : "保存并绑定"}
              </button>
              <button
                type="button"
                disabled={!configured || busy !== null}
                onClick={() => void test()}
                className="rounded-full border border-[var(--life-border-soft)] bg-white/75 px-4 py-2 text-xs font-extrabold text-[var(--life-text)] disabled:opacity-40"
              >
                {busy === "test" ? "发送中…" : "发一条测试微信"}
              </button>
              {configured ? (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void clear()}
                  className="rounded-full px-3 py-2 text-xs font-bold text-[var(--life-danger)] disabled:opacity-40"
                >
                  {busy === "clear" ? "解绑中…" : "解绑"}
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-4 text-[var(--life-text-muted)]">
            token 会加密保存在 Supabase Vault，页面只能看到“已绑定/未绑定”，不会把 token 读回来。提醒由云端每 5 分钟自动检查，不需要打开网站。
          </p>
          <a
            href="https://www.pushplus.plus/"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-[10px] font-extrabold text-[var(--life-teal-strong)] underline decoration-dotted underline-offset-2"
          >
            打开 PushPlus 获取 token
          </a>
          {notice ? <p className="mt-3 text-xs font-bold leading-5 text-[var(--life-teal-strong)]">{notice}</p> : null}
          {error ? <p className="mt-3 text-xs font-bold leading-5 text-[var(--life-danger)]">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
