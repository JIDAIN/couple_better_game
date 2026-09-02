"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";

export function LifeLoginPage() {
  const router = useRouter();
  const { refreshIdentity } = useLifeIdentity();
  const [username, setUsername] = useState("");
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
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "登录失败");
      await refreshIdentity();
      router.replace("/");
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
          <p className="mt-2 text-sm text-[var(--life-text-muted)]">使用原来的账号和密码登录。</p>
        </div>

        <section className="life-surface rounded-[var(--life-radius-card)] p-5">
          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-1.5 text-sm font-bold">
              账号
              <input
                required
                autoFocus
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-normal outline-none focus:border-[var(--life-teal)]"
              />
            </label>
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
              {busy ? "正在登录…" : "登录"}
            </button>
          </form>

          {message ? <p className="mt-3 rounded-2xl bg-[var(--life-surface-warm)] px-3 py-2 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}
        </section>
      </div>
    </main>
  );
}
