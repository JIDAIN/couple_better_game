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
import { GrowthLog, GrowthLogLedgerRow, GrowthRecordDetailModal } from "./GrowthLog";
import { HomeResourcesProvider } from "./HomeResourcesProvider";
import { RecordTodayButton } from "./RecordTodayButton";
import {
  AppBottomNavItem,
  AppButton,
  AppCard,
  AppGameIcon,
  AppNookPhoneFrame,
  AppRoleAvatar,
  AppSceneBoard,
  AppSceneTitle,
  AppSectionPanel,
} from "../ui";

type TabId = "today" | "map" | "shop" | "nest";
type NestViewId = "home" | "rules" | "data" | "log";

const TAB_VALUES: TabId[] = ["today", "map", "shop", "nest"];
const NEST_VIEW_VALUES: NestViewId[] = ["home", "rules", "data", "log"];

function parseHash(rawHash: string): { activeTab: TabId; nestView: NestViewId } {
  const raw = rawHash.replace(/^#/, "");

  if (raw.startsWith("nest/")) {
    const sub = raw.slice(5);
    const nestView = (NEST_VIEW_VALUES as string[]).includes(sub)
      ? (sub as NestViewId)
      : "home";
    return { activeTab: "nest", nestView };
  }

  if (raw === "rules" || raw === "data" || raw === "log") {
    return { activeTab: "nest", nestView: raw };
  }

  for (const tab of TAB_VALUES) {
    if (raw === tab || raw.startsWith(`${tab}/`)) {
      return { activeTab: tab, nestView: "home" };
    }
  }

  return { activeTab: "today", nestView: "home" };
}

function buildHash(tab: TabId, nestView: NestViewId) {
  if (tab === "nest" && nestView !== "home") return `#nest/${nestView}`;
  return `#${tab}`;
}

function useHashSyncedTabs() {
  const [activeTab, setActiveTabState] = useState<TabId>("today");
  const [nestView, setNestViewState] = useState<NestViewId>("home");
  const internalRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const nestViewRef = useRef(nestView);

  useEffect(() => {
    activeTabRef.current = activeTab;
    nestViewRef.current = nestView;
  });

  useEffect(() => {
    const applyHash = () => {
      const next = parseHash(window.location.hash);
      if (next.activeTab !== activeTabRef.current) {
        activeTabRef.current = next.activeTab;
        setActiveTabState(next.activeTab);
      }
      if (next.nestView !== nestViewRef.current) {
        nestViewRef.current = next.nestView;
        setNestViewState(next.nestView);
      }
    };

    applyHash();

    const onHashChange = () => {
      if (internalRef.current) {
        internalRef.current = false;
        return;
      }
      applyHash();
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setActiveTab = useCallback((tab: TabId) => {
    activeTabRef.current = tab;
    setActiveTabState(tab);
    const nextNestView: NestViewId = tab === "nest" ? "home" : nestViewRef.current;
    if (tab === "nest" && nestViewRef.current !== "home") {
      nestViewRef.current = "home";
      setNestViewState("home");
    }
    if (typeof window !== "undefined") {
      const nextHash = buildHash(tab, nextNestView);
      if (window.location.hash !== nextHash) {
        internalRef.current = true;
        window.location.hash = nextHash;
      }
    }
  }, []);

  const setNestView = useCallback((view: NestViewId) => {
    nestViewRef.current = view;
    setNestViewState(view);
    if (typeof window !== "undefined") {
      const nextHash = buildHash(activeTabRef.current, view);
      if (window.location.hash !== nextHash) {
        internalRef.current = true;
        window.location.hash = nextHash;
      }
    }
  }, []);

  return { activeTab, setActiveTab, nestView, setNestView };
}

const SYNC_DISPLAY: Record<string, { label: string; dot: string }> = {
  "正在加载": { label: "加载中…", dot: "sync-status-dot--loading" },
  "已是最新": { label: "已同步", dot: "sync-status-dot--synced" },
  "有未同步修改": { label: "未同步", dot: "sync-status-dot--dirty" },
  "正在同步": { label: "同步中…", dot: "sync-status-dot--syncing" },
  "同步失败": { label: "同步失败", dot: "sync-status-dot--failed" },
};

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
      <p className="campaign-progress-line campaign-progress-line--quiet ui-text-muted">
        开始日待设置
      </p>
    );
  }

  if (!hasStarted) {
    return (
      <p className="campaign-progress-line ui-text-main">
        变美变瘦大作战即将开始
      </p>
    );
  }

  return (
    <p className="campaign-progress-line ui-text-main">
      第 {campaignDayCount} 天 · 今天也在变亮
    </p>
  );
}

function NestRecentRecords() {
  const { dailyRecords } = useHomeResources();
  const [selectedRecord, setSelectedRecord] = useState<DailyRecord | null>(null);
  const recent = useMemo(() => {
    return [...dailyRecords]
      .filter(hasMeaningfulGrowthActivity)
      .sort((a, b) => b.recordDate.localeCompare(a.recordDate))
      .slice(0, 7);
  }, [dailyRecords]);

  if (recent.length === 0) {
    return (
      <AppCard variant="item" className="app-section-panel text-center">
        <p className="text-xs font-semibold ui-text-muted">还没有成长记录</p>
        <p className="mt-0.5 text-[11px] font-medium ui-text-soft">
          去首页记录第一条吧 ✨
        </p>
      </AppCard>
    );
  }

  return (
    <>
      <AppCard variant="item" className="app-section-panel">
        <p className="app-list-title">最近记录</p>
        <div className="growth-log-notebook-list nest-recent-log-list">
          {recent.map((entry) => (
            <GrowthLogLedgerRow
              key={entry.id}
              entry={entry}
              onOpen={setSelectedRecord}
            />
          ))}
        </div>
      </AppCard>
      <GrowthRecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </>
  );
}

function RulesGuideContent() {
  return (
    <div className="app-rules-board">
      <div className="app-section-header">
        <p className="text-base font-bold ui-text-main">规则公告栏</p>
        <p className="mt-0.5 text-xs font-medium ui-text-muted">
          当前版本的金币与宝石规则
        </p>
      </div>

      <div className="app-rules-list">
        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <AppRoleAvatar role="fish" size={16} /> 鱼鱼金币
          </p>
          <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
            <li>热量缺口 ≥200 kcal → <span className="font-bold ui-text-primary">+1</span></li>
            <li>热量缺口 ≥300 kcal → <span className="font-bold ui-text-primary">+2</span></li>
            <li>热量缺口 ≥500 kcal → <span className="font-bold ui-text-primary">+4</span></li>
            <li>有热量缺口 且 运动 ≥30 分钟 → <span className="font-bold ui-text-primary">+1</span></li>
          </ul>
        </AppCard>

        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <AppRoleAvatar role="cat" size={16} /> 猫猫金币
          </p>
          <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
            <li>热量缺口 ≥100 kcal → <span className="font-bold ui-text-primary">+1</span></li>
            <li>热量缺口 ≥200 kcal → <span className="font-bold ui-text-primary">+2</span></li>
            <li>有热量缺口 且 运动 ≥30 分钟 → <span className="font-bold ui-text-primary">+1</span></li>
            <li>有热量缺口 且 运动 ≥60 分钟 → <span className="font-bold ui-text-primary">+2</span></li>
          </ul>
        </AppCard>

        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <AppGameIcon name="recovery" size={16} /> 恢复日奖励
          </p>
          <p className="mt-2 text-xs font-medium ui-text-muted">
            今天有热量缺口，且昨天该成员运动 ≥30 分钟，今天额外
            <span className="font-bold ui-text-primary"> +1</span> 金币
          </p>
        </AppCard>

        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <span aria-hidden><AppRoleAvatar role="fish" size={16} /><AppRoleAvatar role="cat" size={16} /></span>
            双人同行
          </p>
          <p className="mt-2 text-xs font-medium ui-text-muted">
            双方当天都有热量缺口，且双方运动都 ≥30 分钟，共
            <span className="font-bold ui-text-primary"> +2</span> 金币
          </p>
        </AppCard>

        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <AppGameIcon name="gem" size={16} /> 宝石规则
          </p>
          <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
            <li>本周新增金币达到 30 → <span className="font-bold ui-text-reward">+1</span></li>
            <li>本周新增金币达到 50 → <span className="font-bold ui-text-reward">再 +1</span></li>
            <li>双人连续 5 天达到一般打卡 → <span className="font-bold ui-text-reward">+1</span></li>
            <li>本周一起运动达到 2 次 → <span className="font-bold ui-text-reward">+1</span></li>
          </ul>
        </AppCard>

        <AppCard variant="item" className="app-item-row">
          <p className="rule-item-title">
            <AppGameIcon name="info" size={16} /> 其他说明
          </p>
          <ul className="mt-2 space-y-1 text-xs font-medium ui-text-muted">
            <li>运动金币需要当天有热量缺口才会触发</li>
            <li>金币周从 <span className="font-semibold ui-text-main">周六</span> 开始计算</li>
            <li>金币余额上限为 <span className="font-semibold ui-text-main">50</span></li>
            <li>规则说明仅用于解释当前版本，不支持自定义配置</li>
          </ul>
        </AppCard>
      </div>
    </div>
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
  const backToNest = (
    <AppButton
      type="button"
      onClick={() => setNestView("home")}
      aria-label="返回小窝"
      className="app-scene-back-button"
    >
      <span className="app-scene-back-chevron" aria-hidden />
    </AppButton>
  );

  if (nestView === "rules") {
    return (
      <AppSceneBoard scene="rules-board" className="app-subpage-content">
        <AppSceneTitle
          icon="rules"
          title="规则公告栏"
          action={backToNest}
        />
        <RulesGuideContent />
      </AppSceneBoard>
    );
  }

  if (nestView === "data") {
    return (
      <AppSceneBoard scene="toolbox" className="app-subpage-content">
        <AppSceneTitle
          icon="data"
          title="存档工具箱"
          action={backToNest}
        />
        <DataManagement variant="inline" />
      </AppSceneBoard>
    );
  }

  if (nestView === "log") {
    return (
      <AppSceneBoard scene="notebook" className="app-subpage-content">
        <AppSceneTitle
          icon="log"
          title="成长小手账"
          action={backToNest}
        />
        <GrowthLog variant="inline" />
      </AppSceneBoard>
    );
  }

  return (
    <AppSceneBoard scene="nook-phone" className="app-page-surface--fill">
      <AppNookPhoneFrame>
        <AppSceneTitle
          icon="nest"
          title="ours小窝"
        />

      <AppSectionPanel title="同步状态" icon="data">
        <div className="flex items-center gap-2">
          <span className={`sync-status-dot ${config.dot}`} aria-hidden />
          <span className="text-sm font-bold ui-text-main">{config.label}</span>
        </div>
        <p className="mt-1 text-xs font-medium ui-text-muted">{hint}</p>
      </AppSectionPanel>

      <NestRecentRecords />

      <AppSectionPanel title="常用入口" icon="nest" className="flex flex-col gap-2.5">
        <AppButton
          type="button"
          onClick={() => setNestView("log")}
          className="is-nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden><AppGameIcon name="log" size={16} /></span>
          <span>成长日志</span>
        </AppButton>
        <AppButton
          type="button"
          onClick={() => setNestView("data")}
          className="is-nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden><AppGameIcon name="data" size={16} /></span>
          <span>数据管理</span>
        </AppButton>
        <AppButton
          type="button"
          onClick={() => setNestView("rules")}
          className="is-nav inline-flex w-full whitespace-nowrap text-sm"
        >
          <span aria-hidden><AppGameIcon name="rules" size={16} /></span>
          <span>规则说明</span>
        </AppButton>
      </AppSectionPanel>
      </AppNookPhoneFrame>
    </AppSceneBoard>
  );
}

export function HomeScreen() {
  const { activeTab, setActiveTab, nestView, setNestView } = useHashSyncedTabs();
  const mainScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab, nestView]);

  return (
    <HomeResourcesProvider>
      <div className="app-frame">
        <main ref={mainScrollRef} className="app-page-scroll">
          <div className="app-page-content">
            {activeTab === "today" ? (
              <AppSceneBoard scene="notice-board">
                <GameTitle />
                <CampaignProgressBadge />
                <div className="mx-auto w-full max-w-[18rem]">
                  <RecordTodayButton />
                </div>
                <CoupleGrowthPanel />
                <EncouragementQuote />
              </AppSceneBoard>
            ) : activeTab === "map" ? (
              <AppSceneBoard scene="growth-map">
                <AppSceneTitle
                  icon="map"
                  title="成长地图"
                />
                <DualMonthlyHeatmaps />
              </AppSceneBoard>
            ) : activeTab === "shop" ? (
              <AppSceneBoard scene="shop">
                <AppSceneTitle
                  icon="shop"
                  title="🐟🐱小商店"
                />
                <ExchangeShop variant="inline" />
              </AppSceneBoard>
            ) : (
              <NestTabContent nestView={nestView} setNestView={setNestView} />
            )}
          </div>
        </main>

        <nav className="animal-cursor animal-cursor--force app-bottom-bar" aria-label="底部导航">
          <div className="app-bottom-tabs">
            <AppBottomNavItem
              active={activeTab === "today"}
              icon={<AppGameIcon name="calendar" size={18} />}
              label="今日"
              onClick={() => setActiveTab("today")}
            />

            <AppBottomNavItem
              active={activeTab === "map"}
              icon={<AppGameIcon name="map" size={18} />}
              label="地图"
              onClick={() => setActiveTab("map")}
            />

            <div className="shrink-0 px-0.5">
              <RecordTodayButton buttonVariant="today" />
            </div>

            <AppBottomNavItem
              active={activeTab === "shop"}
              icon={<AppGameIcon name="shop" size={18} />}
              label="兑换"
              onClick={() => setActiveTab("shop")}
            />

            <AppBottomNavItem
              active={activeTab === "nest"}
              icon={<AppGameIcon name="nest" size={18} />}
              label="小窝"
              onClick={() => setActiveTab("nest")}
            />
          </div>
        </nav>
      </div>
    </HomeResourcesProvider>
  );
}

