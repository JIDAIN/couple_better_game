"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";

export function LifeCloudGate({ onConnected }: { onConnected: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    const value = password.trim();
    if (!value) return;
    setConnecting(true);
    setError(null);
    try {
      const response = await fetch("/api/cloud-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !body?.ok) throw new Error(body?.error ?? "连接云端失败");
      setPassword("");
      await onConnected();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接云端失败");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <AppPageShell title="岛屿生活" subtitle="连接云端后，继续记录今天。">
      <section className="life-surface life-section-card mx-auto mt-8 max-w-md">
        <div className="mb-4 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full bg-[var(--life-mint)] text-3xl">🏝️</div>
          <h2 className="text-lg font-extrabold text-[var(--life-text)]">回到我们的小岛</h2>
          <p className="mt-1 text-sm text-[var(--life-text-body)]">输入原来的同步密码即可继续。</p>
        </div>
        <div className="grid gap-3">
          <AppInput
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="同步密码"
            onKeyDown={(event) => {
              if (event.key === "Enter") void connect();
            }}
          />
          <AppButton variant="primary" disabled={connecting || !password.trim()} onClick={() => void connect()}>
            {connecting ? "连接中…" : "连接云端"}
          </AppButton>
          {error ? <p className="text-center text-sm text-[var(--life-danger)]">{error}</p> : null}
        </div>
      </section>
    </AppPageShell>
  );
}
