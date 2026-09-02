"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";

type Identity = {
  partnerKey: "cat" | "fish";
  displayName: "我" | "Ta";
};

export function LifeMePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; identity?: Identity }) => {
        if (!cancelled) setIdentity(data.authenticated ? data.identity ?? null : null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setIdentity(null);
    router.push("/login");
  }

  return (
    <AppPageShell title="我的" subtitle="这里负责当前账号和应用设置，不重复小窝里的共同生活内容。">
      {loading ? (
        <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认登录状态…</section>
      ) : !identity ? (
        <section className="life-surface life-section-card">
          <h2 className="text-base font-extrabold">还没有登录</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">程序只有固定的两个账号，继续共用原来的密码。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-5 py-2.5 text-sm font-black text-white">去登录</Link>
        </section>
      ) : (
        <section className="life-surface life-section-card">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--life-surface-soft)] text-2xl" aria-hidden>{identity.partnerKey === "cat" ? "🐱" : "🐟"}</div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold">当前账号：{identity.displayName}</p>
              <p className="mt-1 text-xs text-[var(--life-text-muted)]">身份固定为 {identity.partnerKey}；个人记录只能修改自己这一侧。</p>
            </div>
            <button type="button" onClick={() => void logout()} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--life-text-body)]">退出</button>
          </div>
        </section>
      )}

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold">数据与同步</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">两个人看到同一个生活空间；心情、睡眠、体重等个人记录由登录身份限制写入，药箱、信箱、日历等共同数据继续共享。</p>
      </section>

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold">常用入口</h2>
        <div className="mt-3 grid gap-2">
          <Link href="/nest" className="rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3 text-sm font-bold">🏠 小窝</Link>
          <Link href="/calendar" className="rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3 text-sm font-bold">📅 生活日历</Link>
          <Link href="/nest/game-machine" className="rounded-2xl bg-[var(--life-surface-soft)] px-4 py-3 text-sm font-bold">🎮 游戏机</Link>
        </div>
      </section>
    </AppPageShell>
  );
}
