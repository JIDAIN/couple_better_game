"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { useStaleQuery } from "@/lib/client/use-stale-query";
import { fetchLifeSettings, patchLifeSettings } from "@/lib/life/settings-client";
import { daysTogether, type LifeSettings } from "@/lib/life/settings-service";
import { localIsoDate } from "./today/today-life-model";

const tiles = [
  { href: "/nest/weight", icon: "⚖️", title: "体重", note: "看见变化，也保留每一次记录", tone: "is-blue" },
  { href: "/nest/mailbox", icon: "💌", title: "小信箱", note: "信纸和明信片都收在这里", tone: "is-pink" },
  { href: "/nest/medicine", icon: "🧰", title: "家庭药箱", note: "一起维护数量和有效期", tone: "is-mint" },
  { href: "/nest/game-machine", icon: "🎮", title: "游戏机", note: "小游戏和旧玩法都从这里进入", tone: "is-yellow" },
] as const;

function anniversaryText(value: string | null) {
  if (!value) return "还没有设置纪念日";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function LifeNestPage() {
  const settingsQuery = useStaleQuery<LifeSettings>({ key: "life-settings", fetcher: fetchLifeSettings, staleMs: 60_000 });
  const [anniversaryOpen, setAnniversaryOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const togetherDay = useMemo(() => daysTogether(settingsQuery.data?.anniversaryDate ?? null, localIsoDate()), [settingsQuery.data?.anniversaryDate]);

  function openAnniversary() {
    setDraftDate(settingsQuery.data?.anniversaryDate ?? "");
    setError(null);
    setAnniversaryOpen(true);
  }

  async function saveAnniversary() {
    setSaving(true);
    setError(null);
    try {
      const saved = await patchLifeSettings({ anniversaryDate: draftDate || null });
      settingsQuery.update(saved);
      setAnniversaryOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "纪念日暂时没有保存成功");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppPageShell title="小窝" subtitle="共同的东西，安静地收在这里。">
        <section className="life-nest-scene" aria-label="我们的生活角落">
          <div className="life-nest-window" aria-hidden><span className="life-window-cloud" /><span className="life-window-sun" /></div>
          <div className="life-nest-plant" aria-hidden><i /><i /><i /><i /><span /></div>
          <div className="life-nest-sofa" aria-hidden />
          <Image src="/illustrations/life/activity-girls.png" alt="" width={360} height={240} className="life-nest-people" />
          <div className="life-nest-rug" aria-hidden />
          <div className="life-nest-caption"><strong>我们的生活角落</strong><span>一起生活的日子，会慢慢把这里填满。</span></div>
        </section>

        <button type="button" onClick={openAnniversary} className="life-anniversary-card mt-3 w-full text-left">
          <span className="life-anniversary-art" aria-hidden>♡</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-extrabold tracking-[0.16em] text-[var(--life-text-muted)]">OUR DAY</span>
            <span className="mt-1 block text-sm font-black text-[var(--life-text)]">纪念日</span>
            <span className="mt-1 block text-xs text-[var(--life-text-body)]">{anniversaryText(settingsQuery.data?.anniversaryDate ?? null)}</span>
            {togetherDay ? <span className="mt-1 block text-[11px] font-extrabold text-[var(--life-teal-strong)]">一起度过的第 {togetherDay} 天</span> : null}
          </span>
          <span className="life-wide-chevron" aria-hidden>›</span>
        </button>

        <div className="life-nest-grid mt-3 grid grid-cols-2 gap-2.5">
          {tiles.map((tile) => (
            <Link key={tile.title} href={tile.href} className={`life-nest-tile ${tile.tone}`}>
              <span className="life-nest-tile-art" aria-hidden>{tile.icon}</span>
              <span className="mt-3 text-sm font-black text-[var(--life-text)]">{tile.title}</span>
              <span className="mt-1 text-[10px] leading-5 text-[var(--life-text-muted)]">{tile.note}</span>
              <span className="life-nest-tile-chevron" aria-hidden>›</span>
            </Link>
          ))}
        </div>
      </AppPageShell>

      {anniversaryOpen ? (
        <div className="life-sheet-backdrop" role="presentation" onMouseDown={() => !saving && setAnniversaryOpen(false)}>
          <section className="life-mood-sheet" role="dialog" aria-modal="true" aria-labelledby="anniversary-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-[var(--life-border)]" />
            <div className="text-center">
              <p id="anniversary-title" className="text-lg font-black text-[var(--life-text)]">我们的纪念日</p>
              <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">这是两个人共享的设置，猫猫和鱼鱼都可以修改；首页会据此计算“一起度过的第 N 天”。</p>
            </div>
            <label className="mt-5 grid gap-1.5 text-xs font-bold text-[var(--life-text-body)]">纪念日<AppInput type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} /></label>
            {error ? <p className="mt-3 rounded-2xl bg-[color:color-mix(in_srgb,var(--life-coral)_14%,white)] px-3 py-2 text-xs text-[var(--life-danger)]">{error}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AppButton variant="secondary" disabled={saving} onClick={() => setAnniversaryOpen(false)}>取消</AppButton>
              <AppButton variant="primary" disabled={saving} onClick={() => void saveAnniversary()}>{saving ? "保存中…" : "保存纪念日"}</AppButton>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
