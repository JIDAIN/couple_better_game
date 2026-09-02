import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";

const shortcuts = [
  { href: "/nest", icon: "🏠", title: "小窝", note: "体重、信箱、药箱和游戏机" },
  { href: "/calendar", icon: "📅", title: "生活日历", note: "回看每天的心情与生活记录" },
  { href: "/nest/game-machine", icon: "🎮", title: "游戏机", note: "从这里进入变美变瘦大作战和以后新增的小游戏" },
] as const;

export function LifeMePage() {
  return (
    <AppPageShell title="我的" subtitle="这里放生活系统本身的信息和入口，不把生活数据做成成绩单。">
      <section className="life-surface life-section-card">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-[color:color-mix(in_srgb,var(--life-mint)_32%,white)] text-2xl shadow-[var(--life-shadow-press)]">🌿</div>
          <div>
            <p className="text-base font-extrabold text-[var(--life-text)]">我们的岛屿生活</p>
            <p className="mt-1 text-xs leading-5 text-[var(--life-text-body)]">我 / Ta 共用同一个生活空间。</p>
          </div>
        </div>
      </section>

      <section className="life-surface life-section-card mt-3">
        <h2 className="text-sm font-extrabold text-[var(--life-text)]">数据与同步</h2>
        <div className="mt-3 grid gap-2">
          <div className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--life-text-body)]">云端数据</span><span className="rounded-full bg-[color:color-mix(in_srgb,var(--life-mint)_30%,white)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--life-teal-strong)]">Supabase</span></div>
            <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">生活记录以云端数据为准；浏览器只通过本站 API 读写。</p>
          </div>
          <div className="rounded-2xl bg-[var(--life-surface-soft)] px-3 py-3">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--life-text-body)]">记录原则</span><span className="text-lg" aria-hidden>🫧</span></div>
            <p className="mt-1 text-xs leading-5 text-[var(--life-text-muted)]">记录，不评价；观察，不排名；数字是事实，不是成绩。</p>
          </div>
        </div>
      </section>

      <section className="mt-3">
        <h2 className="px-1 text-xs font-extrabold text-[var(--life-text-muted)]">常用入口</h2>
        <div className="mt-2 grid gap-2.5">
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className="life-surface flex items-center gap-3 rounded-[var(--life-radius-card)] p-4 transition active:scale-[0.99]">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--life-surface-soft)] text-xl">{item.icon}</div>
              <div className="min-w-0 flex-1"><p className="text-sm font-extrabold text-[var(--life-text)]">{item.title}</p><p className="mt-1 text-xs text-[var(--life-text-muted)]">{item.note}</p></div>
              <span className="text-sm font-extrabold text-[var(--life-teal-strong)]" aria-hidden>→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-[var(--life-radius-card)] bg-[var(--life-surface-warm)] px-4 py-3">
        <p className="text-xs leading-5 text-[var(--life-text-body)]">生活系统和旧游戏是两层：生活层负责记录事实；旧游戏只从「小窝 → 游戏机」进入，并继续保留自己的金币、宝石、兑换和结算规则。</p>
      </section>
    </AppPageShell>
  );
}
