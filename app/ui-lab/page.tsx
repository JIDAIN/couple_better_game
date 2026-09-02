"use client";

import {
  ActivityNotePreview,
  FeatureTilesPreview,
  MoodPickerPreview,
  NutritionPreview,
  RoleSwitchPreview,
  SleepRecordPreview,
} from "@/components/life/LifeUiPreview";
import { AppButton } from "@/components/ui/AppButton";
import { AppPageShell } from "@/components/ui/AppPageShell";

function LabSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <div>
        <h2 className="text-base font-extrabold text-[var(--life-text)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-[var(--life-text-body)]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function UiLabPage() {
  return (
    <AppPageShell
      title="岛屿生活 UI Lab"
      subtitle="定稿视觉语言的组件展厅；全部为假数据，不连接 Supabase，也不参与旧游戏结算。"
      actions={<AppButton variant="secondary">V2-UI1</AppButton>}
    >
      <div className="grid gap-7">
        <LabSection title="视觉 Token" subtitle="暖白底 + 薄荷/青绿主识别 + 柔黄/珊瑚/浅蓝点缀；不再使用大面积棕色。">
          <div className="life-surface life-section-card grid grid-cols-4 gap-2 sm:grid-cols-8">
            {[
              ["暖白", "var(--life-bg)"],
              ["薄荷", "var(--life-mint)"],
              ["青绿", "var(--life-teal)"],
              ["柔黄", "var(--life-yellow)"],
              ["珊瑚", "var(--life-coral)"],
              ["浅蓝", "var(--life-blue)"],
              ["柔粉", "var(--life-pink)"],
              ["正文", "var(--life-text)"],
            ].map(([label, color]) => (
              <div key={label} className="grid gap-1.5 text-center text-[10px] text-[var(--life-text-body)]">
                <span className="aspect-square rounded-[var(--life-radius-control)] border border-[var(--life-border-soft)]" style={{ background: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </LabSection>

        <LabSection title="统一双人切换" subtitle="饮食、体重等单人查看页面统一使用“我 / Ta”，不做左右对照。">
          <div className="max-w-xs"><RoleSwitchPreview /></div>
        </LabSection>

        <LabSection title="首页 / 心情" subtitle="保留彩色情绪圆脸；不以人物头像替代心情。">
          <MoodPickerPreview />
        </LabSection>

        <LabSection title="首页 / 睡眠" subtitle="只记录入睡和起床，入口明确，结果不评分。">
          <SleepRecordPreview />
        </LabSection>

        <LabSection title="首页 / 活动" subtitle="活动统一记录；学习、运动、散步和游玩不再拆成多个任务。">
          <ActivityNotePreview />
        </LabSection>

        <LabSection title="饮食 / 营养统计" subtitle="饮食正式页采用左实物照片、右营养统计；这里先锁定统计条视觉。">
          <div className="max-w-md"><NutritionPreview /></div>
        </LabSection>

        <LabSection title="小窝功能入口" subtitle="体重、小信箱、家庭药箱、游戏机共享同一入口卡片语言；游戏机只做游戏列表。">
          <FeatureTilesPreview />
        </LabSection>

        <LabSection title="V2-UI1 验收边界">
          <div className="life-surface life-section-card grid gap-2 text-sm leading-6 text-[var(--life-text-body)]">
            <p>① 后续业务页面只允许使用本视觉 Token、App* 和已批准 Pattern。</p>
            <p>② 低信息密度可以有较强岛屿感；图表、药箱等高密度数据保持清晰克制。</p>
            <p>③ GitHub 外部组件只借成熟交互/结构，视觉必须重新归一。</p>
            <p>④ 当前实验页不读写真实生活数据，V2-P2 才开始接 Life API。</p>
          </div>
        </LabSection>
      </div>
    </AppPageShell>
  );
}
