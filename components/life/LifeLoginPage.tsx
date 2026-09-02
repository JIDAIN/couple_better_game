"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LifeLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; needsEmailConfirmation?: boolean };
      if (!response.ok || !data.ok) throw new Error(data.error || "操作失败");
      if (data.needsEmailConfirmation) {
        setMessage("注册成功，请先到邮箱完成确认，然后回来登录。");
        setMode("login");
        return;
      }
      router.replace("/me");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="island-life-v2 min-h-screen bg-[var(--life-bg)] px-5 py-10 text-[var(--life-text)]">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--life-surface-soft)] text-3xl">🌿</div>
          <h1 className="mt-4 text-2xl font-black">岛屿生活</h1>
          <p className="mt-2 text-sm text-[var(--life-text-muted)]">两个人各自登录，再共享同一个生活空间。</p>
        </div>

        <section className="life-surface rounded-[var(--life-radius-card)] p-5">
          <div className="mb-5 grid grid-cols-2 rounded-full bg-[var(--life-surface-soft)] p-1">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-full px-3 py-2 text-sm font-extrabold ${mode === item ? "bg-white text-[var(--life-teal-strong)] shadow-sm" : "text-[var(--life-text-muted)]"}`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form className="grid gap-4" onSubmit={submit}>
            {mode === "signup" ? (
              <label className="grid gap-1.5 text-sm font-bold">
                怎么称呼你
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-normal outline-none focus:border-[var(--life-teal)]" placeholder="可选" />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-bold">
              邮箱
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-normal outline-none focus:border-[var(--life-teal)]" />
            </label>
            <label className="grid gap-1.5 text-sm font-bold">
              密码
              <input required minLength={mode === "signup" ? 8 : 6} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-normal outline-none focus:border-[var(--life-teal)]" />
            </label>
            <button disabled={busy} className="mt-1 rounded-full bg-[var(--life-teal)] px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              {busy ? "请稍等…" : mode === "login" ? "进入岛屿生活" : "创建账号"}
            </button>
          </form>

          {message ? <p className="mt-4 rounded-2xl bg-[var(--life-surface-warm)] px-3 py-2 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
