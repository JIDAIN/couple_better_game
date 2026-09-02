"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Account = "cat" | "fish";

export function LifeLoginPage() {
  const router = useRouter();
  const [partnerKey, setPartnerKey] = useState<Account>("cat");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerKey, password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "登录失败");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
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
          <p className="mt-2 text-sm text-[var(--life-text-muted)]">还是原来的两个人，只是现在系统会记住是谁登录。</p>
        </div>

        <section className="life-surface rounded-[var(--life-radius-card)] p-5">
          <p className="mb-2 text-xs font-extrabold text-[var(--life-text-muted)]">选择账号</p>
          <div className="grid grid-cols-2 gap-2">
            {(["cat", "fish"] as const).map((account) => {
              const active = partnerKey === account;
              return (
                <button
                  key={account}
                  type="button"
                  onClick={() => setPartnerKey(account)}
                  className={`rounded-[var(--life-radius-card)] border px-4 py-5 text-center transition ${active ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)] shadow-[var(--life-shadow-press)]" : "border-[var(--life-border-soft)] bg-white"}`}
                >
                  <span className="block text-2xl" aria-hidden>{account === "cat" ? "🐱" : "🐟"}</span>
                  <span className="mt-2 block text-sm font-black">{account === "cat" ? "我" : "Ta"}</span>
                </button>
              );
            })}
          </div>

          <form className="mt-5 grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5 text-sm font-bold">
              密码
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-normal outline-none focus:border-[var(--life-teal)]"
              />
            </label>
            <button disabled={busy} className="rounded-full bg-[var(--life-teal)] px-4 py-3 text-sm font-black text-white disabled:opacity-60">
              {busy ? "正在进入…" : `以${partnerKey === "cat" ? "我" : "Ta"}的身份进入`}
            </button>
          </form>

          <p className="mt-4 text-xs leading-5 text-[var(--life-text-muted)]">两个账号继续共用旧程序的同一个密码；账号身份分别固定，不提供注册第三个用户的入口。</p>
          {message ? <p className="mt-3 rounded-2xl bg-[var(--life-surface-warm)] px-3 py-2 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
