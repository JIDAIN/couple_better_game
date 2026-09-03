"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";

export function LifeMePage() {
  const router = useRouter();
  const { currentPartnerKey, mePartnerKey, taPartnerKey, authenticated, loading, refreshIdentity } = useLifeIdentity();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshIdentity();
    router.replace("/login");
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

          <Link href="/ai" className="life-surface mt-3 flex items-center gap-3 rounded-[var(--life-radius-card)] p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--life-surface-soft)] text-sm font-black text-[var(--life-teal-strong)]">AI</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[var(--life-text)]">生活 AI 助手</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">直接问药箱、饮食、体重、日历等真实记录，也可以用自然语言新增、修改、删除和上传餐食照片。</p>
            </div>
            <span className="text-lg font-bold text-[var(--life-text-muted)]">›</span>
          </Link>

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

          <Link href="/me/data" className="life-surface mt-3 flex items-center gap-3 rounded-[var(--life-radius-card)] p-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[var(--life-surface-soft)] text-lg text-[var(--life-teal-strong)]" aria-hidden>🛟</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[var(--life-text)]">数据管理</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">创建恢复点、导出完整 JSON、导入备份，或恢复到以前的生活数据。</p>
            </div>
            <span className="text-lg font-bold text-[var(--life-teal-strong)]" aria-hidden>›</span>
          </Link>

          <button type="button" onClick={() => void logout()} className="mt-4 w-full rounded-full border border-[color:color-mix(in_srgb,var(--life-coral)_35%,var(--life-border-soft))] bg-white/70 px-4 py-3 text-sm font-extrabold text-[var(--life-danger)]">退出当前账号</button>
        </>
      )}
    </AppPageShell>
  );
}