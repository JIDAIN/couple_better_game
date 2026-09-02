"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLifeAuth } from "./LifeAuthProvider";

export function LifeSetupPage() {
  const { loading, authenticated, identity, refresh, logout } = useLifeAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!authenticated) router.replace("/login");
    else if (identity?.coupleSpaceId) router.replace("/");
  }, [authenticated, identity?.coupleSpaceId, loading, router]);

  async function post(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = (await response.json()) as { ok?: boolean; error?: string; identity?: unknown; invite?: { code?: string } };
    if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
    return result;
  }

  async function bootstrap(partnerKey: "cat" | "fish") {
    setBusy(true); setMessage("");
    try {
      await post("/api/auth/pair/bootstrap", { partnerKey });
      await refresh();
      const result = await post("/api/auth/pair/invite");
      setGeneratedCode(result.invite?.code ?? "");
      setMessage("身份已绑定。把下面的邀请码发给 Ta，Ta 注册登录后输入即可加入同一个岛屿。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "绑定失败");
    } finally { setBusy(false); }
  }

  async function acceptInvite() {
    setBusy(true); setMessage("");
    try {
      await post("/api/auth/pair/accept", { code: inviteCode });
      await refresh();
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入失败");
    } finally { setBusy(false); }
  }

  if (loading || !authenticated) return <main className="island-life-v2 min-h-screen bg-[var(--life-bg)]" />;

  return (
    <main className="island-life-v2 min-h-screen bg-[var(--life-bg)] px-5 py-8">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-[var(--life-surface-warm)] text-4xl">🏡</div>
          <h1 className="mt-5 text-2xl font-black text-[var(--life-text)]">把两个人放进同一个小岛</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--life-text-muted)]">每个人都有自己的登录账号，但共享同一份生活空间。Ta 的个人记录由 Ta 自己填写。</p>
        </div>

        <section className="life-surface life-section-card mt-7">
          <h2 className="text-sm font-black text-[var(--life-text)]">如果你是第一个设置的人</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">请选择你在现有数据里的身份。这个选择用于承接之前的 cat / fish 历史记录。</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button disabled={busy} onClick={() => void bootstrap("cat")} className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-4 text-left disabled:opacity-50">
              <div className="text-3xl">🐱</div><p className="mt-2 text-sm font-black text-[var(--life-text)]">我是 cat</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">绑定已有 cat 数据</p>
            </button>
            <button disabled={busy} onClick={() => void bootstrap("fish")} className="rounded-[var(--life-radius-card)] border border-[var(--life-border-soft)] bg-[var(--life-surface-soft)] p-4 text-left disabled:opacity-50">
              <div className="text-3xl">🐟</div><p className="mt-2 text-sm font-black text-[var(--life-text)]">我是 fish</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">绑定已有 fish 数据</p>
            </button>
          </div>
          {generatedCode ? (
            <div className="mt-4 rounded-2xl bg-[var(--life-surface-warm)] px-4 py-3 text-center">
              <p className="text-xs font-bold text-[var(--life-text-muted)]">给 Ta 的一次性邀请码（24 小时）</p>
              <p className="mt-2 select-all font-mono text-2xl font-black tracking-[0.2em] text-[var(--life-text)]">{generatedCode}</p>
            </div>
          ) : null}
        </section>

        <section className="life-surface life-section-card mt-3">
          <h2 className="text-sm font-black text-[var(--life-text)]">如果 Ta 已经给你邀请码</h2>
          <div className="mt-3 flex gap-2">
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} className="min-w-0 flex-1 rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 font-mono text-sm uppercase outline-none focus:border-[var(--life-teal)]" placeholder="输入邀请码" />
            <button disabled={busy || !inviteCode.trim()} onClick={() => void acceptInvite()} className="rounded-2xl bg-[var(--life-teal)] px-4 text-sm font-black text-white disabled:opacity-50">加入</button>
          </div>
        </section>

        {message ? <p className="mt-3 rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}
        <button onClick={() => void logout().then(() => router.replace("/login"))} className="mx-auto mt-6 block text-xs font-bold text-[var(--life-text-muted)] underline underline-offset-4">退出当前账号</button>
      </div>
    </main>
  );
}
