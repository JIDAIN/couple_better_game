"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageShell } from "@/components/ui/AppPageShell";

type Identity = {
  userId: string;
  email: string | null;
  displayName: string | null;
  coupleSpaceId: string | null;
  partnerKey: "cat" | "fish" | null;
  memberRole: "owner" | "member" | null;
};

export function LifeMePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [migrationPassword, setMigrationPassword] = useState("");
  const [role, setRole] = useState<"cat" | "fish">("cat");
  const [message, setMessage] = useState("");

  async function loadSession() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const data = (await response.json()) as { authenticated?: boolean; identity?: Identity };
      setIdentity(data.authenticated ? data.identity ?? null : null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();
  }, []);

  async function post(path: string, body?: unknown) {
    setMessage("");
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string; invite?: { code?: string } };
    if (!response.ok || !data.ok) throw new Error(data.error || "操作失败");
    return data;
  }

  async function bootstrap() {
    try {
      await post("/api/auth/bootstrap", { migrationPassword, partnerKey: role });
      setMigrationPassword("");
      setMessage("身份绑定完成。现在可以生成邀请码给 Ta。");
      await loadSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "绑定失败");
    }
  }

  async function acceptInvite() {
    try {
      await post("/api/auth/pairing/accept", { code: joinCode });
      setJoinCode("");
      setMessage("已经加入你们的双人空间。");
      await loadSession();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入失败");
    }
  }

  async function createInvite() {
    try {
      const data = await post("/api/auth/pairing/invite");
      setInviteCode(data.invite?.code ?? "");
      setMessage("邀请码 24 小时内有效，只发给 Ta。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成邀请码失败");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setIdentity(null);
    router.push("/login");
  }

  return (
    <AppPageShell title="我的" subtitle="账号、双人绑定和同步状态都放在这里。">
      {loading ? (
        <section className="life-surface life-section-card text-sm text-[var(--life-text-muted)]">正在确认登录状态…</section>
      ) : !identity ? (
        <section className="life-surface life-section-card">
          <h2 className="text-base font-extrabold">还没有登录</h2>
          <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">以后“我”和“Ta”分别使用自己的账号，生活记录再通过双人空间共享。</p>
          <Link href="/login" className="mt-4 inline-flex rounded-full bg-[var(--life-teal)] px-5 py-2.5 text-sm font-black text-white">登录 / 注册</Link>
        </section>
      ) : (
        <>
          <section className="life-surface life-section-card">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--life-surface-soft)] text-2xl">🌿</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold">{identity.displayName || identity.email || "岛屿居民"}</p>
                <p className="mt-1 text-xs text-[var(--life-text-muted)]">{identity.partnerKey ? `身份：${identity.partnerKey === "cat" ? "我（cat）" : "我（fish）"}` : "还没有绑定双人空间"}</p>
              </div>
              <button type="button" onClick={() => void logout()} className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--life-text-body)]">退出</button>
            </div>
          </section>

          {!identity.coupleSpaceId ? (
            <section className="life-surface life-section-card mt-3">
              <h2 className="text-sm font-extrabold">加入双人空间</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">如果 Ta 已经建立空间，输入 Ta 发给你的邀请码即可。</p>
              <div className="mt-3 flex gap-2">
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={12} placeholder="12 位邀请码" className="min-w-0 flex-1 rounded-2xl border border-[var(--life-border-soft)] bg-white px-3 py-2.5 text-sm uppercase outline-none" />
                <button type="button" onClick={() => void acceptInvite()} className="rounded-2xl bg-[var(--life-teal)] px-4 py-2.5 text-sm font-black text-white">加入</button>
              </div>

              <div className="my-4 h-px bg-[var(--life-border-soft)]" />
              <p className="text-xs leading-5 text-[var(--life-text-muted)]">第一次迁移旧系统时，只允许一个账号使用旧同步密码建立初始成员。完成后第二个人必须通过邀请码加入。</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRole("cat")} className={`rounded-2xl border px-3 py-2 text-sm font-bold ${role === "cat" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border-soft)]"}`}>我是 cat</button>
                <button type="button" onClick={() => setRole("fish")} className={`rounded-2xl border px-3 py-2 text-sm font-bold ${role === "fish" ? "border-[var(--life-teal)] bg-[var(--life-surface-soft)]" : "border-[var(--life-border-soft)]"}`}>我是 fish</button>
              </div>
              <input type="password" value={migrationPassword} onChange={(event) => setMigrationPassword(event.target.value)} placeholder="旧系统同步密码" className="mt-2 w-full rounded-2xl border border-[var(--life-border-soft)] bg-white px-3 py-2.5 text-sm outline-none" />
              <button type="button" onClick={() => void bootstrap()} className="mt-2 w-full rounded-2xl bg-[var(--life-surface-warm)] px-4 py-2.5 text-sm font-black">建立第一个成员</button>
            </section>
          ) : (
            <section className="life-surface life-section-card mt-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold">双人绑定</h2>
                  <p className="mt-1 text-xs text-[var(--life-text-muted)]">你的账号已经属于这个生活空间。</p>
                </div>
                <span className="rounded-full bg-[var(--life-surface-soft)] px-3 py-1.5 text-xs font-black text-[var(--life-teal-strong)]">已绑定</span>
              </div>
              <button type="button" onClick={() => void createInvite()} className="mt-4 rounded-full bg-[var(--life-teal)] px-4 py-2.5 text-sm font-black text-white">生成给 Ta 的邀请码</button>
              {inviteCode ? <div className="mt-3 rounded-2xl bg-[var(--life-surface-warm)] px-4 py-3 text-center"><p className="text-[10px] font-bold text-[var(--life-text-muted)]">邀请码</p><p className="mt-1 font-mono text-xl font-black tracking-[0.18em]">{inviteCode}</p></div> : null}
            </section>
          )}
        </>
      )}

      {message ? <p className="mt-3 rounded-2xl bg-[var(--life-surface-warm)] px-4 py-3 text-xs leading-5 text-[var(--life-text-body)]">{message}</p> : null}

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold">同步边界</h2>
        <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">生活数据仍然只经本站 API 访问 Supabase。账号身份将逐步替代旧的共享同步密码；旧游戏 `/game` 的稳定逻辑暂不改变。</p>
      </section>
    </AppPageShell>
  );
}
