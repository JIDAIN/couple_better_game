import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";

const tiles = [
  { href: "/nest/weight", icon: "⚖️", title: "体重", note: "看看最近的变化", tone: "bg-[color:color-mix(in_srgb,var(--life-blue)_34%,white)]", active: true },
  { href: "/nest/mailbox", icon: "💌", title: "小信箱", note: "留给彼此的话", tone: "bg-[color:color-mix(in_srgb,var(--life-pink)_36%,white)]", active: true },
  { href: "/nest/medicine", icon: "🧰", title: "家庭药箱", note: "数量、开封与有效期", tone: "bg-[color:color-mix(in_srgb,var(--life-teal)_24%,white)]", active: true },
  { href: "/nest/game-machine", icon: "🎮", title: "游戏机", note: "小游戏都放在这里", tone: "bg-[color:color-mix(in_srgb,var(--life-yellow)_38%,white)]", active: true },
] as const;

export function LifeNestPage() {
  return (
    <AppPageShell title="小窝" subtitle="不常用、但属于我们生活的东西，都收在这里。">
      <section className="life-surface life-section-card overflow-hidden">
        <div className="rounded-[var(--life-radius-card)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--life-pink)_18%,white),color-mix(in_srgb,var(--life-yellow)_20%,white))] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/80 text-2xl shadow-[var(--life-shadow-press)]">🏡</div>
            <div><p className="text-base font-extrabold text-[var(--life-text)]">我们的生活角落</p><p className="mt-1 text-xs leading-5 text-[var(--life-text-body)]">这里不做排名，也不把数字当成绩。</p></div>
          </div>
        </div>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {tiles.map((tile) => {
          const body = <><div className={`grid h-12 w-12 place-items-center rounded-2xl text-2xl shadow-[var(--life-shadow-press)] ${tile.tone}`}>{tile.icon}</div><div className="mt-3"><p className="text-sm font-extrabold text-[var(--life-text)]">{tile.title}</p><p className="mt-1 text-[11px] leading-5 text-[var(--life-text-muted)]">{tile.note}</p></div><div className="mt-auto pt-3 text-[10px] font-extrabold text-[var(--life-teal-strong)]">打开 →</div></>;
          return <Link key={tile.title} href={tile.href} className="life-surface flex min-h-44 flex-col rounded-[var(--life-radius-card)] p-4 transition active:scale-[0.98]">{body}</Link>;
        })}
      </div>
      <section className="mt-3 rounded-[var(--life-radius-card)] bg-[var(--life-surface-warm)] px-4 py-3"><p className="text-xs font-bold text-[var(--life-text-body)]">小窝四个入口已经接通</p><p className="mt-1 text-[11px] leading-5 text-[var(--life-text-muted)]">体重、小信箱、家庭药箱和游戏机现在都有各自独立入口；旧游戏继续完整保留在 /game。</p></section>
    </AppPageShell>
  );
}
