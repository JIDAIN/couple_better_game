"use client";

import { ActivityNotePreview, FeatureTilePreview, MoodPickerPreview, SleepRecordPreview } from "@/components/life/LifeUiPreview";
import { AppButton } from "@/components/ui/AppButton";
import { AppCard } from "@/components/ui/AppCard";
import { AppRoleAvatar } from "@/components/ui/AppRoleAvatar";
import { AppSceneBoard, AppSceneTitle, AppSectionPanel } from "@/components/ui/AppScene";

export default function UiLabPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-3 pb-16 pt-5 sm:px-5">
      <div className="mb-4 rounded-[var(--radius-card)] border border-[var(--card-border-soft)] bg-[var(--card-bg-strong)]/90 px-4 py-3 text-sm leading-6 text-[var(--text-body)] shadow-[var(--shadow-soft)]">
        <strong>V2 UI Lab</strong>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          这里仅用于视觉与交互实验，不读取或修改真实生活数据，也不参与旧游戏结算。
        </p>
      </div>

      <AppSceneBoard scene="notebook">
        <AppSceneTitle
          icon="notebook"
          title="岛屿生活视觉实验室"
          subtitle="先把语言统一，再组装正式页面。"
        />

        <div className="grid gap-5 py-2">
          <AppSectionPanel title="Foundation / 当前 App*">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <AppButton variant="primary">主要操作</AppButton>
                <AppButton variant="secondary">次要操作</AppButton>
                <AppButton variant="ghost">轻操作</AppButton>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <AppCard variant="soft" className="!p-3">
                  <p className="text-xs text-[var(--text-muted)]">soft</p>
                  <strong className="mt-1 block text-sm text-[var(--text-main)]">柔和信息卡</strong>
                </AppCard>
                <AppCard variant="compact" className="!p-3">
                  <p className="text-xs text-[var(--text-muted)]">compact</p>
                  <strong className="mt-1 block text-sm text-[var(--text-main)]">紧凑记录卡</strong>
                </AppCard>
                <AppCard variant="panel" className="!p-3">
                  <p className="text-xs text-[var(--text-muted)]">panel</p>
                  <strong className="mt-1 block text-sm text-[var(--text-main)]">功能面板</strong>
                </AppCard>
              </div>
              <div className="flex items-center gap-3 rounded-[var(--radius-panel)] bg-[var(--bg-warm)] px-3 py-2">
                <AppRoleAvatar role="fish" size={34} />
                <AppRoleAvatar role="cat" size={34} />
                <p className="text-xs leading-5 text-[var(--text-body)]">
                  角色只用于标识“谁记录了什么”，生活系统不把角色视觉自动转成排名或输赢。
                </p>
              </div>
            </div>
          </AppSectionPanel>

          <AppSectionPanel title="Life Pattern / 心情">
            <MoodPickerPreview />
          </AppSectionPanel>

          <AppSectionPanel title="Life Pattern / 睡眠">
            <SleepRecordPreview />
          </AppSectionPanel>

          <AppSectionPanel title="Life Pattern / 活动">
            <ActivityNotePreview />
          </AppSectionPanel>

          <AppSectionPanel title="小窝入口浓度测试">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FeatureTilePreview icon="💊" title="家庭药箱" description="库存、位置、保质期；后续支持 AI 查询与确认后修改。" />
              <FeatureTilePreview icon="⚖️" title="体重记录" description="低频事实独立查看，不放在今日首页。" />
              <FeatureTilePreview icon="💌" title="小信箱" description="想写时再写，不做每日任务。" />
              <FeatureTilePreview icon="🎮" title="游戏机" description="原变美变瘦大作战完整保留，但退出生活主流程。" />
            </div>
          </AppSectionPanel>

          <AppSectionPanel title="本轮设计检查">
            <div className="grid gap-2 text-sm leading-6 text-[var(--text-body)]">
              <p>① 低密度首页可以更有岛屿感，高密度数据页要更克制。</p>
              <p>② 日期、时间、输入等成熟交互不为了主题重新发明。</p>
              <p>③ 外部 GitHub UI 只能经过 App* / Pattern 适配后进入业务层。</p>
              <p>④ 当前页面全部是假数据，正式 V2 首页接 Life API 之前先做视觉确认。</p>
            </div>
          </AppSectionPanel>
        </div>
      </AppSceneBoard>
    </main>
  );
}
