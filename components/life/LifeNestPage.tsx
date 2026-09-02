import Image from "next/image";
import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";

const tiles = [
  { href: "/nest/weight", icon: "⚖️", title: "体重", note: "各自记录，彼此查看", tone: "is-blue" },
  { href: "/nest/mailbox", icon: "💌", title: "小信箱", note: "写给彼此的话", tone: "is-pink" },
  { href: "/nest/medicine", icon: "🧰", title: "家庭药箱", note: "共同维护家里的药", tone: "is-mint" },
  { href: "/nest/game-machine", icon: "🎮", title: "游戏机", note: "小游戏都从这里进入", tone: "is-yellow" },
] as const;

export function LifeNestPage() {
  return (
    <AppPageShell title="小窝" subtitle="这里放两个人共同拥有、共同使用的生活内容。">
      <section className="life-nest-scene" aria-label="我们的生活角落">
        <div className="life-nest-window" aria-hidden><span className="life-window-cloud" /><span className="life-window-sun" /></div>
        <div className="life-nest-plant" aria-hidden><i /><i /><i /><i /><span /></div>
        <div className="life-nest-sofa" aria-hidden />
        <Image src="/illustrations/life/activity-girls.png" alt="" width={360} height={240} className="life-nest-people" />
        <div className="life-nest-rug" aria-hidden />
        <div className="life-nest-caption"><strong>我们的生活角落</strong><span>共同的东西，安静地收在这里。</span></div>
      </section>

      <div className="life-nest-grid mt-3 grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <Link key={tile.title} href={tile.href} className={`life-nest-tile ${tile.tone}`}>
            <span className="life-nest-tile-icon" aria-hidden>{tile.icon}</span>
            <span className="mt-3 text-sm font-black text-[var(--life-text)]">{tile.title}</span>
            <span className="mt-1 text-[10px] leading-5 text-[var(--life-text-muted)]">{tile.note}</span>
            <span className="mt-auto pt-3 text-[10px] font-extrabold text-[var(--life-teal-strong)]">打开 →</span>
          </Link>
        ))}
      </div>
    </AppPageShell>
  );
}
