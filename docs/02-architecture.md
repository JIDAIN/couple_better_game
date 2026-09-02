# 当前架构

## 1. 一句话架构

项目是一个 **Next.js 一体化 Web 应用**：浏览器负责游戏 UI、饮食 UI 和本地游戏运行状态；Vercel API 负责浏览器安全边界；Supabase 负责云端持久化；ChatGPT 在用户明确确认后通过受限 meal RPC 写入餐食。

```text
Browser
├─ 游戏 UI / Provider / localStorage game cache
├─ 饮食 UI / Meal API client
└─ 同日关联展示（只读）
       │
       ▼
Next.js / Vercel
├─ API auth
├─ validation
└─ Supabase RPC client
       │
       ▼
Supabase PostgreSQL

ChatGPT（明确确认后）
-> authorized Supabase connector
-> service-only ChatGPT meal RPC
-> meals / meal_items
```

## 2. 目录职责

### `components/home/`

- 游戏业务 UI；
- `HomeResourcesProvider`；
- 游戏状态 / 同步编排。

### `components/nutrition/`

当前主要组件：

```text
DailyMealsPanel.tsx    饮食列表 + P2.5 同日关联展示
MealEditorModal.tsx    手动新增 / 编辑餐食
```

`DailyMealsPanel` 的写入仍只走 Meal API；P2.5 只是**只读**消费 `HomeResourcesProvider.dailyRecords` 以展示同一天游戏快照。

### `components/ui/`

项目 UI adapter / wrapper，优先组合 `App*` 和 `animal-island-ui`，不创建第二套 Button / Card / Modal 视觉体系。

### `lib/home/`

```text
types.ts                    游戏领域类型
settlement-rules.ts         游戏纯规则
daily-record-service.ts     每日记录状态变更
daily-record-utils.ts       日期 / record 工具
daily-overview-service.ts   P2.5 date + role 只读选择器
home-stat-service.ts        钱包 / 周统计 / 回算
home-state-service.ts       初始化 / 恢复
app-data-store.ts           snapshot 接口
local-storage-*             浏览器缓存
import/export               备份 / CSV / 兼容迁移
sync-state-service.ts       同步 guard / retry
```

### `lib/nutrition/`

```text
meal-service.ts              Meal 类型 / payload 校验
meal-client.ts               Browser -> `/api/meals`
chatgpt-meal-protocol.ts     ChatGPT confirmed payload / idempotency
```

### `lib/server/`

- `cloud-request-auth.ts`
- `supabase-home-sync.ts`
- `supabase-nutrition.ts`

### `supabase/migrations/`

保存 production 数据库结构、函数和权限历史。

## 3. 游戏本地与云端数据流

本地：

```text
Home UI
-> useHomeResources()
-> HomeResourcesProvider action
-> lib/home service / rules
-> AppDataStore
-> localStorage
```

云端写入：

```text
HomeResourcesState
-> POST /api/save-data
-> cloud-session guard
-> normalize snapshot
-> replace_home_sync_snapshot RPC
-> Supabase normalized tables
```

云端读取：

```text
DataManagement
-> /data/couple-data.json [legacy compatibility URL]
-> proxy.ts
-> /api/home-data
-> export_home_sync_snapshot
-> Supabase
-> compatible snapshot
-> local state / localStorage
```

`reloadFromGitHub / syncToGitHub / /data/couple-data.json` 只是 legacy 内部名称 / shim，当前真实云端数据源是 Supabase。

## 4. 饮食数据流

### Web

```text
DailyMealsPanel / MealEditorModal
-> meal-client
-> /api/meals or /api/meals/[id]
-> cloud request auth
-> supabase-nutrition
-> transaction RPC
-> meals + meal_items
```

### ChatGPT

```text
图片 / 描述 / 估算 / 修正
-> 不写
-> 用户明确“记上”
-> create_chatgpt_meal_record
-> meals + meal_items
-> get_chatgpt_meal_record(same key)
-> 成功后确认
```

当前角色映射：

```text
用户自己的饮食聊天 -> cat（猫猫）
鱼鱼的饮食聊天     -> fish（鱼鱼）
```

## 5. P2.5 同日关联架构（已上线）

关联键：

```text
partnerKey + date
```

当前实现不新增数据库、不新增 API：

```text
DailyMealsPanel
├─ Meal API
│  -> meals / meal_items
│  -> 当天餐数 / 总摄入 / 可用总区间
│
└─ useHomeResources().dailyRecords
   -> selectDailyGameOverview(records, date, role)
   -> deficit / exercise / game weight snapshot
        ↓
LinkedDailySummary AppCard
```

行为：

- Meal API 加载成功且有餐食 → 展示总摄入；
- 所有餐都有 min/max → 展示当天总摄入区间；
- 无 meals → 摄入显示“未记录”；
- Meal API 失败 → 摄入显示“暂未加载”，不伪装成 0；
- 无该日 `DailyRecord` → 游戏侧显示“当天游戏记录未填写”；
- 有该日 `DailyRecord` → 展示该角色已有 deficit / minutes / weightKg；
- 不根据 intake 写回 deficit；
- 不为了 UI 完整自动创建 daily record。

### 已知模型限制

旧 `DailyRecord` 没有“某一侧是否主动填写过 0”的 presence 标记。

所以：

```text
日期无 DailyRecord -> 可以确定整天游戏记录不存在
日期有 DailyRecord -> 只能展示该角色保存下来的当前值，包括 0
```

前端不能可靠推断某个 0 到底是“主动填写 0”还是旧模型在另一角色补录时留下的零值。若未来需要区分，应该新增明确 schema 语义，而不是写启发式判断。

## 6. 数据域边界

```text
intake ≠ deficit ≠ weight ≠ exercise
```

- intake：`meals / meal_items`
- deficit：`daily_record_sides.deficit_kcal`
- weight：真实趋势用 `weight_measurements`，游戏快照用 `daily_record_sides.weight_kg`
- exercise：`daily_record_sides.exercise_minutes`

P2.5 只是展示层关联。

## 7. UI 场景边界

主导航仍固定：

```text
今日 / 地图 / 兑换 / 小窝
```

饮食和 P2.5 都位于 `#today` notice-board 的 `AppSectionPanel「饮食小记」` 内。

“当天合在一起看”使用现有 `AppCard`、`AppRoleAvatar`、文本 token 和圆角层级，不新增视觉 primitive。

## 8. 数据库与安全边界

Web：

```text
Browser                无 Supabase secret
Next.js server         持有 server secret
Supabase tables        RLS enabled
anon/authenticated     无当前业务 policy
service role           经 API / RPC 使用
```

ChatGPT：

```text
普通聊天文本           不包含 secret
authorized connector   用户授权能力
ChatGPT meal RPC       service-only
anon/authenticated     无 execute
```

P2.5 没有新增数据库权限面。

## 9. Migration 规则

- production schema / function / view / grant / RLS 变化必须新增 migration；
- 已执行 migration 不回头修改；
- migration 保存在 `supabase/migrations/`；
- migration 不等于 production 数据备份。

## 10. 当前技术债

- Provider 内仍有 GitHub legacy 命名和兼容 URL；
- cloud-session helper 仍有部分重复；
- sync metadata/password 仍有旧 localStorage 直接访问；
- 游戏结算仍不是 server-authoritative；
- 当前共享 password/session 不是完整用户身份模型；
- ChatGPT 首版只专门支持新增 meal，已保存餐食更新/删除仍通过 Web UI；
- `DailyRecord` 缺少每一侧独立 input-presence 语义。

这些债务不要在无关功能中顺手重构。
