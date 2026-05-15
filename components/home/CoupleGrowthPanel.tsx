"use client";

import { GEM_CAP, useHomeResources } from "./HomeResourcesProvider";

function resourceIcon(tone: "gem" | "coin" | "heart") {
  if (tone === "gem") return "💎";
  if (tone === "coin") return "🪙";
  return "🔥";
}

function StatBubble({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "gem" | "coin" | "heart";
}) {
  const toneRing =
    tone === "gem"
      ? "ui-tinted-primary"
      : tone === "coin"
        ? "ui-tinted-reward"
        : "ui-tinted-growth";
  const icon = resourceIcon(tone);

  return (
    <div className={`ui-card-soft ui-card-item relative overflow-hidden ${toneRing}`}>
      <p className="text-[11px] font-semibold tracking-wide ui-text-muted">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1 text-[1.1rem] font-bold tabular-nums ui-text-main">
        <span aria-hidden className="text-[0.95rem]">
          {icon}
        </span>
        <span suppressHydrationWarning>{value}</span>
      </p>
    </div>
  );
}

function GemTreasureBar({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const pct = Math.min(100, Math.round((current / max) * 100));

  return (
    <div className="ui-card-soft ui-card-item ui-sparkle-card relative overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold ui-text-main">💎 宝石小宝箱</span>
        <span suppressHydrationWarning className="text-[11px] font-semibold tabular-nums ui-text-muted">
          {current} / {max}
        </span>
      </div>
      <div
        className="ui-progress-track mt-2 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div
          className="ui-progress-fill h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] font-medium ui-text-muted">
        装满以后会有小惊喜
      </p>
    </div>
  );
}

export function CoupleGrowthPanel() {
  const {
    gemStock,
    coinStock,
    cumulativeSuccessDays,
    yesterdayGemTotal,
    weekGemTotal,
    weekCoinTotal,
  } = useHomeResources();

  return (
    <section
      className="ui-card ui-card-main animate-card-breathe sm:p-5"
      aria-label="情侣成长资源"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-wide ui-text-main">
          今日小收获
        </h2>
        <span className="text-lg" aria-hidden>
          📒
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium ui-text-muted">
        我们攒下的闪光
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatBubble label="昨日宝石" value={yesterdayGemTotal} tone="gem" />
        <StatBubble label="本周宝石" value={weekGemTotal} tone="gem" />
      </div>

      <div className="mt-2">
        <GemTreasureBar current={gemStock} max={GEM_CAP} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatBubble label="本周金币" value={weekCoinTotal} tone="coin" />
        <StatBubble label="金币存钱罐" value={coinStock} tone="coin" />
      </div>

      <div className="ui-card-soft ui-card-item ui-tinted-primary mt-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide ui-text-primary">
              一起坚持的小火苗
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums ui-text-main">
              <span suppressHydrationWarning>{cumulativeSuccessDays}</span>
              <span className="ml-1 text-sm font-semibold ui-text-muted">天</span>
            </p>
          </div>
          <span className="text-2xl" aria-hidden>
            🔥
          </span>
        </div>
      </div>
    </section>
  );
}
