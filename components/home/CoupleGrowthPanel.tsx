"use client";

import { GEM_CAP, useHomeResources } from "./HomeResourcesProvider";

function StatBubble({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string | number;
  unit: string;
  tone: "gem" | "coin" | "heart";
}) {
  const toneRing =
    tone === "gem"
      ? "ui-tinted-primary"
      : tone === "coin"
        ? "ui-tinted-reward"
        : "ui-tinted-growth";

  return (
    <div
      className={`ui-card-soft relative overflow-hidden ${toneRing} p-3`}
    >
      <p className="text-[11px] font-semibold tracking-wide ui-text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-[1.1rem] font-bold tabular-nums ui-text-main">
        {value}
        <span className="ml-0.5 text-xs font-semibold ui-text-muted">
          {unit}
        </span>
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
    <div className="ui-card-soft p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold ui-text-main">宝石小宝箱</span>
        <span className="text-[11px] font-semibold tabular-nums ui-text-muted">
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
        装满会有小惊喜哦
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
      className="ui-card animate-card-breathe p-4 sm:p-5"
      aria-label="情侣成长资源"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-wide ui-text-main">
          成长补给站
        </h2>
        <span className="text-lg" aria-hidden>
          📝
        </span>
      </div>
      <p className="mt-0.5 text-[10px] font-medium ui-text-muted">
        两个人的小小收获面板
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatBubble label="昨日宝石" value={yesterdayGemTotal} unit="颗" tone="gem" />
        <StatBubble label="本周宝石" value={weekGemTotal} unit="颗" tone="gem" />
      </div>

      <div className="mt-2">
        <GemTreasureBar current={gemStock} max={GEM_CAP} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <StatBubble label="本周金币" value={weekCoinTotal} unit="枚" tone="coin" />
        <StatBubble label="金币存钱罐" value={coinStock} unit="枚" tone="coin" />
      </div>

      <div className="ui-card-soft ui-tinted-primary mt-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold tracking-wide ui-text-primary">
              双人热量缺口连击
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums ui-text-main">
              {cumulativeSuccessDays}
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
