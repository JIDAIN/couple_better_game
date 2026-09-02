"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeAuth } from "@/components/auth/LifeAuthProvider";

export function LifeMePage() {
  const { identity, logout } = useLifeAuth();
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function createInvite() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/pair/invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = (await response.json()) as { ok?: boolean; error?: string; invite?: { code?: string } };
      if (!response.ok || !result.ok) throw new Error(result.error || "生成邀请码失败");
      setInviteCode(result.invite?.code ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成邀请码失败");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const roleLabel = identity?.partnerKey === "cat" ? "cat / 我" : identity?.partnerKey === "fish" ? "fish / 我" : "未绑定";

  return (
    <AppPageShell title="我的" subtitle="账号、双人绑定与同步状态。">
      <section className="life-surface life-section-card">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--life-mint)_32%,white)] text-2xl shadow-[var(--life-shadow-press)]">{identity?.partnerKey === "fish" ? "🐟" : "🐱"}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold text-[var(--life-text)]">{identity?.displayName || "岛屿成员"}</p>
            <p className="mt-1 truncate text-xs text-[var(--life-text-muted)]">{identity?.email}</p>
          </div>
          <span className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--life-teal-strong)]">{roleLabel}</span>
        </div>
      </section>

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold text-[var(--life-text)]">双人空间</h2>
        <div className="mt-3 rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-[var(--life-text-body)]">绑定状态</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">当前账号已绑定到共同生活空间。</p></div>
            <span className="text-lg">🏡</span>
          </div>
        </div>
        <button disabled={busy} onClick={() => void createInvite()} className="mt-3 w-full rounded-2xl border border-[var(--life-border-soft)] bg-white px-4 py-3 text-sm font-extrabold text-[var(--life-teal-strong)] disabled:opacity-50">{busy ? "生成中…" : "生成给 Ta 的新邀请码"}</button>
        {inviteCode ? <div className="mt-3 rounded-2xl bg-[var(--life-surface-warm)] px-4 py-3 text-center"><p className="text-xs text-[var(--life-text-muted)]">24 小时内有效</p><p className="mt-2 select-all font-mono text-xl font-black tracking-[0.18em] text-[var(--life-text)]">{inviteCode}</p></div> : null}
        {message ? <p className="mt-2 text-xs text-[var(--life-coral)]">{message}</p> : null}
      </section>

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold text-[var(--life-text)]">数据与同步</h2>
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3">
          <div><p className="text-sm font-bold text-[var(--life-text-body)]">云端同步</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">Supabase · 登录账号隔离</p></div>
          <span className="rounded-full bg-[color:color-mix(in_srgb,var(--life-mint)_30%,white)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--life-teal-strong)]">已连接</span>
        </div>
      </section>

      <button onClick={() => void signOut()} className="mt-4 w-full rounded-2xl bg-[var(--life-surface-warm)] px-4 py-3 text-sm font-extrabold text-[var(--life-text-body)]">退出登录</button>
    </AppPageShell>
  );
}
