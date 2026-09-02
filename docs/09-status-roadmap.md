# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前阶段

项目当前已经具备：

```text
成熟的双人游戏前端
+ localStorage 游戏运行缓存
+ Supabase 云端主数据
+ Next.js 安全 API
+ 今日饮食 Web UI
+ ChatGPT 明确确认后的餐食持久化
+ 同日饮食 / 游戏记录关联展示
```

当前里程碑：

```text
P0 工程治理                 ✅
P1 今日饮食 UI              ✅
P2 ChatGPT “记上”           ✅
P2.5 同日饮食 + 游戏记录    ✅
↓
P3 体重趋势                 当前下一步
↓
P4 完整统一每日总览
```

## 2. 功能进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 每日双人打卡 | ✅ | deficit / exercise / weight snapshot |
| 游戏结算 | ✅ | 当前规则由前端 service 计算 |
| 历史补录 / 编辑 / 删除 | ✅ | 修改历史后会重算派生状态 |
| 月度成长地图 | ✅ | 周六到周五，跨月真实记录 |
| 成长日志 | ✅ | 查看和管理历史 |
| 兑换商店 | ✅ | 分类、兑换、历史记录 |
| JSON 备份 / 恢复 | ✅ | schemaVersion 1 + currency semantics 兼容 |
| 周复盘 CSV | ✅ | 只导出 |
| animal-island-ui 视觉体系 | ✅ | App* wrapper 持续维护 |
| Supabase schema / migrations | ✅ | production migration 已纳入仓库 |
| 游戏云端读取 / 写入 | ✅ | Supabase-only 主路径 |
| 新设备首次连接保护 | ✅ | download-before-write |
| 公开 GitHub JSON 退出 | ✅ 当前代码完成 | cached view 等待 GitHub Support |
| Nutrition schema | ✅ | meals / meal_items / foods / aliases |
| Meal CRUD API | ✅ | transaction RPC |
| Meal Web UI | ✅ | 今日公告板内按日期/角色 CRUD + 明细 |
| ChatGPT “记上” | ✅ | explicit confirm + service-only RPC + idempotency + read-back |
| 同日关联展示 | ✅ | `partnerKey + date` 关联 intake 与 daily record |
| Weight schema | ✅ | `weight_measurements` 已存在 |
| Weight API / trend UI | ⏳ | P3 当前下一步 |
| Goal period schema | ✅ | UI 未实现 |
| 完整账号 / membership | ⏳ Later | 当前只共享密码/session |
| Server-authoritative 游戏结算 | ⏳ Later | 服务端目前不独立重算整套奖励 |

## 3. 数据边界

四个健康数据域必须保持独立：

```text
intake ≠ deficit ≠ weight ≠ exercise
```

真相来源：

```text
intake    -> meals / meal_items
deficit   -> daily_record_sides.deficit_kcal
weight    -> weight_measurements
exercise  -> daily_record_sides.exercise_minutes
```

P2.5 只改变**展示关系**：同一个 `partnerKey + date` 下把这些事实放在一起看，不自动互相覆盖。

## 4. P2.5 — 同日饮食与游戏记录关联（已完成）

### 4.1 产品落点

仍然位于：

```text
#today
-> notice-board
-> AppSectionPanel「饮食小记」
```

没有新增第五个底部 Tab，也没有创建第二套视觉体系。

### 4.2 已实现

- [x] 日期 + 角色仍由饮食面板统一选择；
- [x] 计算当天餐数和总摄入 kcal；
- [x] 当所有餐均有区间时显示当天总摄入区间；
- [x] 同一张“当天合在一起看”卡片显示游戏热量缺口；
- [x] 同时显示当天运动分钟；
- [x] 同时显示当天游戏体重快照；
- [x] 当天没有 daily record 时明确显示“当天游戏记录未填写”；
- [x] 餐食未记录时实际摄入显示“未记录”；
- [x] 饮食 API 加载失败时显示“暂未加载”，不会误显示成 0 kcal；
- [x] 不根据 meals 自动覆盖 deficit；
- [x] 不自动创建缺失的 daily record；
- [x] 新增纯函数 `selectDailyGameOverview()`；
- [x] 新增对应 Vitest，覆盖日期与角色选择、缺失状态。

### 4.3 当前实现路径

```text
DailyMealsPanel
├─ Meal API -> Supabase meals / meal_items
└─ useHomeResources().dailyRecords
   -> selectDailyGameOverview(date, role)
        ↓
“当天合在一起看” AppCard
```

这是**只读关联**。饮食仍不进入游戏 `HomeResourcesState`。

### 4.4 已知模型边界

旧 `DailyRecord` 模型没有单独的“某一侧是否主动填写过 0”标记。

因此当前 P2.5 的判断是：

- 该日期没有 `DailyRecord` → 明确视为“当天游戏记录未填写”；
- 该日期存在 `DailyRecord` → 展示其中该角色已有的 deficit / minutes / weight snapshot，包括 0 值。

不要在 UI 中进一步猜测“0 是主动填写还是旧模型补零”。如果以后确实需要区分，应通过明确 schema / migration 增加 presence 语义，而不是靠前端启发式判断。

### 4.5 验证

对应代码提交已完成：

```text
lib/home/daily-overview-service.ts
components/nutrition/DailyMealsPanel.tsx
tests/home/daily-overview-service.test.ts
```

GitHub Actions：

```text
Test  ✅
Lint  ✅
Build ✅
```

Vercel production：`READY`。

没有做真实手机逐像素视觉验收，因此 CI 通过不等于视觉已经人工确认。

## 5. P3 — 体重趋势（当前下一步）

目标：

- `weight_measurements` CRUD / API；
- 当前体重；
- 趋势折线；
- 同日多次测量策略；
- 旧每日打卡 weight snapshot 与 measurement 的关系；
- daily overview 优先读取真实 measurement summary；
- UI 延续现有动森感 App* 体系，不重做主导航。

开发前先审查现有 `weight_measurements` schema、`daily_weight_summary` view 和旧 `DailyRecordSide.weightKg` 的关系。

## 6. P4 — 完整统一每日总览

在 P3 后继续扩展同日视图：

```text
实际摄入
+ 真实体重
+ 游戏 deficit
+ 运动
+ 当日游戏奖励
```

可继续利用已有：

```text
daily_nutrition_summary
daily_weight_summary
partner_daily_overview
```

四个域并列展示，但不互相偷偷改值。

## 7. Later — 架构强化

### 游戏结算服务端权威化

前端仍可 preview，但最终保存由服务端根据原始输入重算 reward / wallet。

### 真正用户身份

如果从两人私人应用扩展，再设计：

- User/Auth
- CoupleSpace membership
- per-user authorization
- RLS policy
- device/session revoke
- conflict strategy

### 兼容债清理

有完整测试与生产迁移证明后再处理：

- rename `reloadFromGitHub / syncToGitHub`；
- 移除 `/data/couple-data.json` proxy shim；
- 统一 cloud-session helper；
- 抽离 sync metadata storage。

不要在普通业务功能里顺手做这些迁移。

## 8. 外部事项

### GitHub cached views

GitHub Support `Clear Cached Views` 工单已创建。平台处理完成后：

1. 测试旧 sensitive commit/blob URL；
2. 确认不可访问 / 404；
3. 记录完成时间到 CHANGELOG；
4. 再评估旧 Vercel deployment 是否需要额外处理。

## 9. “下一步是什么”的简单答案

当前直接进入：

```text
P3 — 体重趋势
```

除非用户改变优先级，以本文件为准。