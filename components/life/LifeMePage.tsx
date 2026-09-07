"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useLifeIdentity } from "@/components/life/LifeIdentityContext";
import { LifeWechatReminderCard } from "@/components/life/LifeWechatReminderCard";

export function LifeMePage() {
  const router = useRouter();
  const { currentPartnerKey, authenticated, loading, refreshIdentity } = useLifeIdentity();
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); await refreshIdentity(); router.replace("/login"); }
  const accountName = currentPartnerKey === "cat" ? "小猫" : currentPartnerKey === "fish" ? "小鱼" : "未登录";
  const accountIcon = currentPartnerKey === "cat" ? "🐱" : "🐟";
  return (
    <AppPageShell title="我的">
      {loading ? <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认登录状态…</section> : !authenticated || !currentPartnerKey ? (
        <section className="life-surface life-section-card"><h2 className="text-base font-extrabold">还没有登录</h2><Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-5 py-2.5 text-sm font-black text-white">去登录</Link></section>
      ) : (
        <div className="grid gap-3">
          <section className="life-account-hero life-account-hero-v3"><div className="life-account-avatar" aria-hidden>{accountIcon}</div><div className="min-w-0 flex-1"><p className="text-lg font-black text-[var(--life-text)]">{accountName}</p></div></section>
          <section className="life-settings-list life-settings-list-v3"><div className="life-settings-row"><span className="life-settings-icon" aria-hidden>☁️</span><div className="min-w-0 flex-1"><p className="text-sm font-extrabold">云端同步</p></div><span className="life-status-dot">已连接</span></div></section>
          <LifeWechatReminderCard actor={currentPartnerKey} />
          <Link href="/me/reminders" className="life-surface flex items-center gap-3 rounded-[var(--life-radius-card)] p-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[var(--life-surface-soft)] text-lg" aria-hidden>🔔</div><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[var(--life-text)]">提醒中心</p><p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">查看接下来、药箱到期和自定义提醒。</p></div><span className="life-wide-chevron" aria-hidden>›</span></Link>
          <Link href="/me/data" className="life-surface life-me-data-card flex items-center gap-3 rounded-[var(--life-radius-card)] p-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-[var(--life-surface-soft)] text-lg text-[var(--life-teal-strong)]" aria-hidden>🛟</div><div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[var(--life-text)]">数据管理</p><p className="mt-1 text-[10px] leading-4 text-[var(--life-text-muted)]">备份、导出、导入和恢复。</p></div><span className="life-wide-chevron" aria-hidden>›</span></Link>
          <button type="button" onClick={() => void logout()} className="mt-1 w-full rounded-full border border-[color:color-mix(in_srgb,var(--life-coral)_35%,var(--life-border-soft))] bg-white/70 px-4 py-3 text-sm font-extrabold text-[var(--life-danger)]">退出当前账号</button>
        </div>
      )}
    </AppPageShell>
  );
}
