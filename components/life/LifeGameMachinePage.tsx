import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { lifeGameRegistry } from "@/lib/life/game-registry";

export function LifeGameMachinePage() {
  return (
    <AppPageShell
      title="游戏机"
      subtitle="这里放明确的小游戏；生活记录本身不做排名和竞技。"
      actions={<Link href="/nest" className="rounded-full bg-[var(--life-surface-soft)] px-3 py-2 text-xs font-extrabold text-[var(--life-teal-strong)]">返回小窝</Link>}
    >
      <section className="life-surface life-section-card overflow-hidden">
        <div className="rounded-[var(--life-radius-card)] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--life-yellow)_22%,white),color-mix(in_srgb,var(--life-blue)_16%,white))] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-2xl shadow-[var(--life-shadow-press)]">🎮</div>
            <div>
              <p className="text-base font-extrabold text-[var(--life-text)]">我们的小型游戏厅</p>
              <p className="mt-1 text-xs leading-5 text-[var(--life-text-body)]">游戏可以有输赢、积分和奖励，但边界只留在游戏里。</p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-3 grid gap-3">
        {lifeGameRegistry.map((game) => {
          const available = game.status === "available" && Boolean(game.route);
          const body = (
            <>
              <div className="flex items-start gap-3">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[color:color-mix(in_srgb,var(--life-yellow)_28%,white)] text-3xl shadow-[var(--life-shadow-press)]">{game.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-extrabold text-[var(--life-text)]">{game.title}</h2>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${available ? "bg-[color:color-mix(in_srgb,var(--life-mint)_30%,white)] text-[var(--life-teal-strong)]" : "bg-[var(--life-surface-soft)] text-[var(--life-text-muted)]"}`}>
                      {available ? "可游玩" : "以后开放"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--life-text-muted)]">{game.description}</p>
                </div>
              </div>
              <div className="mt-4 text-right text-xs font-extrabold text-[var(--life-teal-strong)]">{available ? "开始游戏 →" : "敬请期待"}</div>
            </>
          );

          if (available && game.route) {
            return <Link key={game.gameKey} href={game.route} className="life-surface rounded-[var(--life-radius-card)] p-4 transition active:scale-[0.99]">{body}</Link>;
          }
          return <article key={game.gameKey} aria-disabled="true" className="life-surface rounded-[var(--life-radius-card)] p-4 opacity-85">{body}</article>;
        })}
      </div>

      <section className="mt-3 rounded-[var(--life-radius-card)] bg-[var(--life-surface-warm)] px-4 py-3">
        <p className="text-xs font-bold text-[var(--life-text-body)]">当前只接一个已有游戏</p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--life-text-muted)]">这一页只负责列出游戏和跳转；不复制旧游戏逻辑，也不新增游戏详情页。</p>
      </section>
    </AppPageShell>
  );
}
