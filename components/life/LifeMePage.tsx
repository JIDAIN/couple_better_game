"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";

export function LifeMePage() {
  const router = useRouter();
  const { currentPartnerKey, mePartnerKey, taPartnerKey, authenticated, loading } = useLifeIdentity();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const accountName = currentPartnerKey === "cat" ? "猫猫（cat）" : currentPartnerKey === "fish" ? "鱼鱼（fish）" : "未登录";
  const accountIcon = currentPartnerKey === "cat" ? "🐱" : "🐟";

  return (
    <AppPageShell title="我的" subtitle="这里只管当前账号、同步和数据边界；共同生活内容都留在小窝。">
      {loading ? (
        <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认登录状态…</section>
      ) : !authenticated || !currentPartnerKey ? (
        <section className="life-surface life-section-card">
          <h2 className="text-base font-extrabold">还没有登录</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">固定两个账号继续共用原来的密码。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-5 py-2.5 text-sm font-black text-white">去登录</Link>
        </section>
      ) : (
        <>
          <section className="life-account-hero">
            <div className="life-account-avatar" aria-hidden>{accountIcon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--life-teal-strong)]">CURRENT ACCOUNT</p>
              <p className="mt-1 text-lg font-black text-[var(--life-text)]">{accountName}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">在所有生活页面里，当前账号就是“我”；另一方自动显示为“Ta”。</p>
            </div>
          </section>

          <section className="life-settings-list mt-3">
            <div className="life-settings-row">
              <span className="life-settings-icon">👤</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">身份映射</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">我 = {mePartnerKey} · Ta = {taPartnerKey}</p></div>
              <span className="life-status-dot">已登录</span>
            </div>
            <div className="life-settings-row">
              <span className="life-settings-icon">☁️</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">云端同步</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">生活数据以 Supabase 为事实源；页面缓存只用于减少重复加载。</p></div>
              <span className="life-status-dot">已连接</span>
            </div>
            <div className="life-settings-row">
              <span className="life-settings-icon">🔐</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">写入权限</p><p className="mt-0.5 text-[10px] text-[var(--life-text-muted)]">个人记录各自维护；药箱、日历等共同内容继续共享查看。</p></div>
            </div>
          </section>

          <section className="life-surface life-section-card mt-3">
            <h2 className="text-sm font-extrabold">数据管理</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">新版生活数据由各领域 API 写入云端。旧“变美变瘦大作战”的 JSON 备份与恢复能力仍留在旧游戏本身，不在“我的”重复再做一套。</p>
            <Link href="/nest/game-machine" className="mt-3 inline-flex rounded-full bg-[var(--life-surface-soft)] px-4 py-2.5 text-xs font-extrabold text-[var(--life-teal-strong)]">去游戏机</Link>
          </section>

          <button type="button" onClick={() => void logout()} className="mt-4 w-full rounded-full border border-[color:color-mix(in_srgb,var(--life-coral)_35%,var(--life-border-soft))] bg-white/70 px-4 py-3 text-sm font-extrabold text-[var(--life-danger)]">退出当前账号</button>
        </>
      )}
    </AppPageShell>
  );
}
