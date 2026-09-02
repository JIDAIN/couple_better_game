"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLifeAuth } from "./LifeAuthProvider";

type Mode = "login" | "register";

export function LifeLoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useLifeAuth();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; requiresEmailConfirmation?: boolean; identity?: { coupleSpaceId?: string | null } | null };
      if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
      if (result.requiresEmailConfirmation) {
        setMessage("注册成功，请先到邮箱完成验证，然后回来登录。");
        setMode("login");
        return;
      }
      await refresh();
      const next = searchParams.get("next") || "/";
      router.replace(result.identity?.coupleSpaceId ? next : "/setup");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="island-life-v2 min-h-screen bg-[var(--life-bg)] px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-[color:color-mix(in_srgb,var(--life-mint)_34%,white)] text-4xl shadow-[var(--life-shadow-card)]">🌿</div>
          <h1 className="mt-5 text-2xl font-black text-[var(--life-text)]">回到我们的岛屿</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--life-text-muted)]">每个人使用自己的账号登录；进入同一个双人空间后，记录会自动同步。</p>
        </div>

        <section className="life-surface life-section-card mt-8">
          <div className="grid grid-cols-2 rounded-[var(--life-radius-control)] bg-[var(--life-surface-soft)] p-1">
            {(["login", "register"] as const).map((value) => (
              <button key={value} type="button" onClick={() => { setMode(value); setMessage(""); }} className={`rounded-[var(--life-radius-control)] px-4 py-2.5 text-sm font-extrabold ${mode === value ? "bg-white text-[var(--life-teal-strong)] shadow-sm" : "text-[var(--life-text-muted)]"}`}>
                {value === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            {mode === "register" ? (
              <label className="grid gap-1.5 text-xs font-bold text-[var(--life-text-body)]">昵称（可选）
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--life-teal)]" placeholder="例如：小猫" />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-xs font-bold text-[var(--life-text-body)]">邮箱
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--life-teal)]" placeholder="name@example.com" />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-[var(--life-text-body)]">密码
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--life-teal)]" placeholder="至少 8 位" />
            </label>
            {message ? <p className="rounded-2xl bg-[var(--life-surface-warm)] px-3 py-2 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}
            <button disabled={busy} className="rounded-2xl bg-[var(--life-teal)] px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "正在处理…" : mode === "login" ? "登录" : "创建账号"}</button>
          </form>
        </section>
      </div>
    </main>
  );
}
