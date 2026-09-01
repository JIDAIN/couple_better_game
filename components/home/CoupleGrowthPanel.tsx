"use client";

import { GEM_CAP, useHomeResources } from "./HomeResourcesProvider";
import { Title } from "animal-island-ui";
import { AppCard, AppGameIcon, AppProgressBar } from "../ui";

function resourceIcon(tone: "gem" | "coin" | "heart") {
  if (tone === "gem") return <AppGameIcon name="gem" size={16} />;
  if (tone === "coin") return <AppGameIcon name="coin" size={16} />;
  return <AppGameIcon name="fire" size={16} />;
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
      ? "app-token-gem"
      : tone === "coin"
        ? "app-token-coin"
        : "app-token-growth";

  return (
    <AppCard variant="item" className={`relative overflow-hidden ${toneRing}`}>
      <p className="text-[11px] font-semibold tracking-wide ui-text-muted">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1 text-[1.1rem] font-bold tabular-nums ui-text-main">
        {resourceIcon(tone)}
        <span suppressHydrationWarning>{value}</span>
      </p>
    </AppCard>
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
    <AppCard
      variant="main"
      className="animate-card-breathe sm:p-5"
      aria-label="情侣成长资源"
    >
      <div className="flex items-center justify-between gap-2">
        <Title size="small" color="app-yellow">
          今日小收获
        </Title>
        <AppGameIcon name="notebook" size={28} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatBubble label="昨日金币" value={yesterdayGemTotal} tone="coin" />
        <StatBubble label="本周金币" value={weekCoinTotal} tone="coin" />
      </div>

      <div className="mt-2">
        <AppProgressBar value={coinStock} max={GEM_CAP} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatBubble label="本周宝石" value={weekGemTotal} tone="gem" />
        <StatBubble label="宝石存钱罐" value={gemStock} tone="gem" />
      </div>

      <AppCard variant="item" className="app-token-gem mt-3">
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
          <AppGameIcon name="fire" size={28} />
        </div>
      </AppCard>
    </AppCard>
  );
}
