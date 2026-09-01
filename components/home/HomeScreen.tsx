"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, useState } from "react";
import { useHomeResources, type DailyRecord } from "./HomeResourcesProvider";
import { hasMeaningfulGrowthActivity } from "@/lib/home/daily-record-utils";
import { getCampaignDayCount } from "./mockHeatmapData";

import { CoupleGrowthPanel } from "./CoupleGrowthPanel";
import { DataManagement } from "./DataManagement";
import { DualMonthlyHeatmaps } from "./DualMonthlyHeatmaps";
import { EncouragementQuote } from "./EncouragementQuote";
import { ExchangeShop } from "./ExchangeShop";
import { GameTitle } from "./GameTitle";
import { GrowthLog } from "./GrowthLog";
import { HomeResourcesProvider } from "./HomeResourcesProvider";
import { RecordTodayButton } from "./RecordTodayButton";
import { AppButton } from "../ui";

type TabId = "today" | "map" | "shop" | "nest";
type NestViewId = "home" | "rules" | "data" | "log";

const TAB_VALUES: TabId[] = ["today", "map", "shop", "nest"];
const NEST_VIEW_VALUES: NestViewId[] = ["home", "rules", "data", "log"];

function readTabFromHash(): TabId {
  if (typeof window === "undefined") return "today";
  const raw = window.location.hash.replace(/^#/, "");
  for (const tab of TAB_VALUES) {
    if (raw === tab || raw.startsWith(`${tab}/`)) return tab;
  }
  return "today";
}

function readNestViewFromHash(): NestViewId {
  if (typeof window === "undefined") return "home";
  const raw = window.location.hash.replace(/^#/, "");
  if (raw.startsWith("nest/")) {
    const sub = raw.slice(5);
    if ((NEST_VIEW_VALUES as string[]).includes(sub)) return sub as NestViewId;
  }
  return "home";
}

function buildHash(tab: TabId, nestView: NestViewId) {
  if (tab === "nest" && nestView !== "home") return `#nest/${nestView}`;
  return `#${tab}`;
}

function useHashSyncedTabs() {
  const [activeTab, setActiveTab] = useState<TabId>(readTabFromHash);
  const [nestView, setNestViewState] = useState<NestViewId>(readNestViewFromHash);
  const internalRef = useRef(false);
  const mountedRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const nestViewRef = useRef(nestView);

  useEffect(() => {
    activeTabRef.current = activeTab;
    nestViewRef.current = nestView;
  });

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    internalRef.current = true;
    window.location.hash = buildHash(activeTab, nestView);
  }, [activeTab, nestView]);

  useEffect(() => {
    const onHashChange = () => {
      if (internalRef.current) {
        internalRef.current = false;
        return;
      }
      const nextTab = readTabFromHash();
      const nextNest = readNestViewFromHash();
      if (nextTab !== activeTabRef.current) setActiveTab(nextTab);
      if (nextNest !== nestViewRef.current) setNestViewState(nextNest);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setNestView = useCallback((view: NestViewId) => {
    setNestViewState(view);
  }, []);

  return { activeTab, setActiveTab, nestView, setNestView };
}

function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return null;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "刚刚";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}天前`;
  return null;
}

const SYNC_DISPLAY: Record<string, { label: string; dot: string }> = {
  "正在加载": { label: "加载中…", dot: "sync-status-dot--loading" },
  "已是最新": { label: "已同步", dot: "sync-status-dot--synced" },
  "有未同步修改": { label: "未同步", dot: "sync-status-dot--dirty" },
  "正在同步": { label: "同步中…", dot: "sync-status-dot--syncing" },
  "同步失败": { label: "同步失败", dot: "sync-status-dot--failed" },
};

function SyncStatusBar() {
  const { syncStatus, syncErrorCode, lastSyncedAt } = useHomeResources();
  const config = SYNC_DISPLAY[syncStatus] ?? SYNC_DISPLAY["已是最新"];
  const timeLabel =
    syncStatus === "已是最新" ? formatRelativeTime(lastSyncedAt) : null;
  const errorLabel =
    syncErrorCode === "MISSING_PASSWORD"
      ? "需保存密码"
      : syncStatus === "同步失败"
        ? "可手动同步"
        : null;

  return (
    <div className="sync-status-bar ui-text-muted">
      <span className={`sync-status-dot ${config.dot}`} aria-hidden />
      <span>{config.label}</span>
      {errorLabel ? <span>· {errorLabel}</span> : null}
      {timeLabel ? <span>· {timeLabel}</span> : null}
    </div>
  );
}

function CampaignProgressBadge() {
  const { heatmapStartDate } = useHomeResources();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const campaignDayCount = mounted
    ? getCampaignDayCount(heatmapStartDate, new Date())
    : null;
  const hasStartDate = heatmapStartDate.length > 0;
  const hasStarted = campaignDayCount != null && campaignDayCount > 0;

  if (!hasStartDate) {
    return (
      <div className="app-card--soft app-card--compact mx-auto w-full max-w-[28rem] text-center text-[12px] font-semibold ui-text-muted">
        设置作战开始日后，就能记录我们的第几天啦
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="app-card--soft app-card--compact mx-auto w-full max-w-[28rem] text-center text-[12px] font-semibold ui-text-main">
        变美变瘦大作战即将开始
      </div>
    );
  }

  return (
    <div className="app-card--soft app-card--compact mx-auto w-full max-w-[28rem] text-center">
      <span className="ui-badge ui-chip-primary">变美变瘦大作战已开启</span>
      <span className="ml-2 text-[1.03rem] font-black tabular-nums ui-text-main">
        第 {campaignDayCount} 天 ✨
      </span>
    </div>
  );
}

function formatMonthDay(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

function totalGems(record: DailyRecord) {
  return record.fish.gems + record.cat.gems + record.bonus;
}

function coinAmountLabel(coins: number) {
  return coins > 0 ? `金币 +${coins}` : "金币 0";
}

function NestRecentRecords() {
  const { dailyRecords } = useHomeResources();
  const recent = useMemo(() => {
    return [...dailyRecords]
      .filter(hasMeaningfulGrowthActivity)
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
      .slice(0, 5);
  }, [dailyRecords]);

  if (recent.length === 0) {
    return (
      <div className="app-card--panel app-card--item text-center">
        <p className="text-xs font-semibold ui-text-muted">还没有成长记录</p>
        <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
          去首页记录第一条吧 ✨
        </p>
      </div>
    );
  }

  return (
    <div className="app-card--panel app-card--item">
      <h3 className="mb-2 text-xs font-bold ui-text-main">最近记录</h3>
      <div className="flex flex-col gap-1.5">
        {recent.map((entry) => (
          <div key={entry.id} className="nest-record-row">
            <span className="nest-record-date">{formatMonthDay(entry.recordDate)}</span>
            <span className="nest-record-meta">
              <span className="ui-price-pill ui-chip-primary">💎 +{totalGems(entry)}</span>
              <span className="ui-price-pill ui-chip-reward">
                {coinAmountLabel(entry.coins)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesGuideContent() {
  return (
    <>
      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>🐟</span> 鱼鱼宝石
        </h3>
        <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
          <li>热量缺口 ≥200 kcal → <span className="font-bold ui-text-primary">+1</span></li>
          <li>热量缺口 ≥300 kcal → <span className="font-bold ui-text-primary">+2</span></li>
          <li>热量缺口 ≥500 kcal → <span className="font-bold ui-text-primary">+4</span></li>
          <li>有热量缺口 且 运动 ≥30 分钟 → <span className="font-bold ui-text-primary">+1</span></li>
        </ul>
      </section>

      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>🐱</span> 猫猫宝石
        </h3>
        <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
          <li>热量缺口 ≥100 kcal → <span className="font-bold ui-text-primary">+1</span></li>
          <li>热量缺口 ≥200 kcal → <span className="font-bold ui-text-primary">+2</span></li>
          <li>有热量缺口 且 运动 ≥30 分钟 → <span className="font-bold ui-text-primary">+1</span></li>
          <li>有热量缺口 且 运动 ≥60 分钟 → <span className="font-bold ui-text-primary">+2</span></li>
        </ul>
      </section>

      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>🔄</span> 恢复日奖励
        </h3>
        <p className="mt-2 text-xs font-medium ui-text-muted">
          今天有热量缺口，且昨天该成员运动 ≥30 分钟，今天额外
          <span className="font-bold ui-text-primary"> +1</span> 宝石
        </p>
      </section>

      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>🐟🐱</span>
        </h3>
        <p className="mt-2 text-xs font-medium ui-text-muted">
          双方当天都有热量缺口，且双方运动都 ≥30 分钟，共
          <span className="font-bold ui-text-primary"> +2</span> 宝石
        </p>
      </section>

      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>🪙</span> 金币规则
        </h3>
        <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
          <li>本周新增宝石达到 30 → <span className="font-bold ui-text-reward">+1</span></li>
          <li>本周新增宝石达到 50 → <span className="font-bold ui-text-reward">再 +1</span></li>
          <li>双人连续 5 天达到一般打卡 → <span className="font-bold ui-text-reward">+1</span></li>
          <li>本周一起运动达到 2 次 → <span className="font-bold ui-text-reward">+1</span></li>
        </ul>
      </section>

      <section className="app-card--panel app-card--item">
        <h3 className="text-sm font-bold ui-text-main">
          <span aria-hidden>💡</span> 其他说明
        </h3>
        <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
          <li>运动宝石需要当天有热量缺口才会触发</li>
          <li>金币周从 <span className="font-semibold ui-text-main">周六</span> 开始计算</li>
          <li>宝石余额上限为 <span className="font-semibold ui-text-main">50</span></li>
          <li>规则说明仅用于解释当前版本，不支持自定义配置</li>
        </ul>
      </section>
    </>
  );
}

function NestSubPageHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <>
      <div className="nest-subpage-header">
        <AppButton type="button" className="app-back-button" onClick={onBack}>
          ‹ 返回
        </AppButton>
        <h2 className="nest-subpage-title-main">{title}</h2>
        <div className="nest-subpage-spacer" aria-hidden />
      </div>
      {subtitle ? <p className="nest-subpage-subtitle">{subtitle}</p> : null}
    </>
  );
}

function NestTabContent({
  nestView,
  setNestView,
}: {
  nestView: NestViewId;
  setNestView: (view: NestViewId) => void;
}) {
  const { syncStatus, syncErrorReason, lastSyncedAt } = useHomeResources();
  const config = SYNC_DISPLAY[syncStatus] ?? SYNC_DISPLAY["已是最新"];
  const timeLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : null;

  const hintMap: Record<string, string> = {
    "正在加载": "正在检查同步状态…",
    "已是最新": timeLabel ? `最近同步：${timeLabel}` : "数据已同步",
    "有未同步修改": syncErrorReason ?? "本地已保存，稍后会尝试同步",
    "正在同步": "正在同步到云端…",
    "同步失败": syncErrorReason ?? "可以进入「数据管理」查看或手动同步",
  };
  const hint = hintMap[syncStatus] ?? hintMap["已是最新"];

  const handleBack = () => setNestView("home");

  if (nestView === "rules") {
    return (
      <div className="flex flex-col gap-4">
        <NestSubPageHeader
          title="规则说明"
          subtitle="当前版本的宝石与金币规则"
          onBack={handleBack}
        />
        <div className="flex flex-col gap-3">
          <RulesGuideContent />
        </div>
      </div>
    );
  }

  if (nestView === "data") {
    return (
      <div className="flex flex-col gap-4">
        <NestSubPageHeader title="数据管理" onBack={handleBack} />
        <DataManagement variant="inline" />
      </div>
    );
  }

  if (nestView === "log") {
    return (
      <div className="flex flex-col gap-4">
        <NestSubPageHeader title="成长日志" onBack={handleBack} />
        <GrowthLog variant="inline" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center pt-2">
        <span className="text-2xl" aria-hidden>🏠</span>
        <h2 className="mt-2 text-xl font-bold ui-text-main">我们的小窝</h2>
        <p className="mt-1 text-xs font-medium ui-text-muted">记录、备份和设置都放在这里</p>
      </div>

      <div className="app-card--panel app-card--item">
        <div className="flex items-center gap-2">
          <span className={`sync-status-dot ${config.dot}`} aria-hidden />
          <span className="text-sm font-bold ui-text-main">{config.label}</span>
        </div>
        <p className="mt-1 text-xs font-medium ui-text-muted">{hint}</p>
      </div>

      <NestRecentRecords />

      <div className="app-card--soft app-card--main flex flex-col gap-2.5">
        <AppButton
          type="button"
          onClick={() => setNestView("log")}
          className="app-button--nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden>📒</span>
          <span>成长日志</span>
        </AppButton>
        <AppButton
          type="button"
          onClick={() => setNestView("data")}
          className="app-button--nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden>📤</span>
          <span>数据管理</span>
        </AppButton>
        <AppButton
          type="button"
          onClick={() => setNestView("rules")}
          className="app-button--nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden>📋</span>
          <span>规则说明</span>
        </AppButton>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const { activeTab, setActiveTab, nestView, setNestView } = useHashSyncedTabs();

  return (
    <HomeResourcesProvider>
      <div className="relative flex min-h-dvh flex-col overflow-x-hidden">
        <div
          aria-hidden
          className="ui-ambient-primary pointer-events-none absolute -right-20 top-10 h-56 w-56 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="ui-ambient-reward pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full blur-3xl"
        />
        <div
          aria-hidden
          className="ui-ambient-growth pointer-events-none absolute bottom-0 right-1/4 h-48 w-48 rounded-full blur-3xl"
        />

        <div className="app-top-status fixed left-0 right-0 top-0 z-30">
          <SyncStatusBar />
        </div>

        <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-4.5 overflow-y-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(2.75rem+env(safe-area-inset-top))] sm:px-5">
          {activeTab === "today" ? (
            <>
              <GameTitle />
              <CampaignProgressBadge />
              <CoupleGrowthPanel />
              <EncouragementQuote />
            </>
          ) : activeTab === "map" ? (
            <DualMonthlyHeatmaps />
          ) : activeTab === "shop" ? (
            <ExchangeShop variant="inline" />
          ) : (
            <NestTabContent nestView={nestView} setNestView={setNestView} />
          )}
        </div>

        <div className="app-bottom-bar fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center">
          <div className="flex w-full max-w-md items-end gap-1 px-2.5 sm:gap-1.5 sm:px-4 pt-0.5">
            <AppButton
              type="button"
              onClick={() => setActiveTab("today")}
              className={`app-bottom-nav-item flex-1 py-2.5 text-sm font-semibold transition ${
                activeTab === "today"
                  ? "app-bottom-nav-item--active ui-text-primary"
                  : "ui-text-muted"
              }`}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-base" aria-hidden>
                  📅
                </span>
                <span className="text-[11px]">今日</span>
              </span>
            </AppButton>

            <AppButton
              type="button"
              onClick={() => setActiveTab("map")}
              className={`app-bottom-nav-item flex-1 py-2.5 text-sm font-semibold transition ${
                activeTab === "map"
                  ? "app-bottom-nav-item--active ui-text-primary"
                  : "ui-text-muted"
              }`}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-base" aria-hidden>
                  🗺️
                </span>
                <span className="text-[11px]">地图</span>
              </span>
            </AppButton>

            <div className="shrink-0 px-0.5">
              <RecordTodayButton buttonVariant="today" />
            </div>

            <AppButton
              type="button"
              onClick={() => setActiveTab("shop")}
              className={`app-bottom-nav-item flex-1 py-2.5 text-sm font-semibold transition ${
                activeTab === "shop"
                  ? "app-bottom-nav-item--active ui-text-primary"
                  : "ui-text-muted"
              }`}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-base" aria-hidden>
                  🎁
                </span>
                <span className="text-[11px]">兑换</span>
              </span>
            </AppButton>

            <AppButton
              type="button"
              onClick={() => setActiveTab("nest")}
              className={`app-bottom-nav-item flex-1 py-2.5 text-sm font-semibold transition ${
                activeTab === "nest"
                  ? "app-bottom-nav-item--active ui-text-primary"
                  : "ui-text-muted"
              }`}
            >
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-base" aria-hidden>
                  🏠
                </span>
                <span className="text-[11px]">小窝</span>
              </span>
            </AppButton>
          </div>
        </div>
      </div>
    </HomeResourcesProvider>
  );
}
