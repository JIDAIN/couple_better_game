import Link from "next/link";
import { AppPageShell } from "@/components/ui/AppPageShell";
import { lifeGameRegistry } from "@/lib/life/game-registry";

export function LifeGameMachinePage() {
  return (
    <AppPageShell
      title="游戏机"
      subtitle="想玩的时候，就从这里挑一个。"
      actions={<Link href="/nest" className="life-back-link">返回小窝</Link>}
    >
      <section className="life-game-hero">
        <div className="life-game-hero-icon" aria-hidden>🎮</div>
        <div>
          <p className="text-base font-extrabold text-[var(--life-text)]">我们的小型游戏厅</p>
          <p className="mt-1 text-xs leading-5 text-[var(--life-text-body)]">偶尔认真玩一局，也只是一起生活的一部分。</p>
        </div>
      </section>

      <div className="mt-3 grid gap-2.5">
        {lifeGameRegistry.map((game) => {
          const available = game.status === "available" && Boolean(game.route);
          const body = (
            <>
              <div className="life-game-card-icon" aria-hidden>{game.icon}</div>
              <div className="life-game-card-copy">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-[var(--life-text)]">{game.title}</h2>
                  {!available ? <span className="life-game-coming">以后开放</span> : null}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--life-text-muted)]">{game.description}</p>
              </div>
              {available ? <span className="life-game-chevron" aria-hidden>›</span> : null}
            </>
          );

          if (available && game.route) {
            return <Link key={game.gameKey} href={game.route} className="life-game-card">{body}</Link>;
          }
          return <article key={game.gameKey} className="life-game-card is-disabled">{body}</article>;
        })}
      </div>
    </AppPageShell>
  );
}
