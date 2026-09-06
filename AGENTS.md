# AGENTS.md

本文件是所有 AI 编程助手和自动化开发工具的项目级规则。修改代码、数据库、测试、文档前必须先阅读本文件。

## 1. 项目现状

项目技术栈：Next.js 16 / React 19 / TypeScript / Tailwind CSS / `animal-island-ui` / Vitest / Vercel / Supabase PostgreSQL。

当前不是纯前端项目：Browser -> Next.js API -> server-only Supabase；localStorage 仍承担 Legacy Game 运行缓存/离线兜底；Supabase 是生产云端事实源。

当前产品关系：

```text
Couple Better Game（当前主程序 / Island Life）
└─ 游戏
   └─ 变瘦变美大作战（Legacy Game 子项目）
```

旧版“变瘦变美大作战”已经被收纳为新程序「游戏」中的独立子项目，不再代表整个应用。

## 2. 开始任务前必读

至少阅读：

1. `README.md`
2. `docs/README.md`
3. `docs/09-status-roadmap.md`
4. 与任务相关的主文档和源码

按任务追加：

| 任务 | 必读 |
|---|---|
| 产品 / 页面流程 | `docs/01-product.md` |
| 架构 / 重构 | `docs/02-architecture.md` |
| 数据字段 / Supabase | `docs/03-data-model.md` |
| 数据清理 / import / restore / Legacy Game 边界 | `docs/48-life-legacy-game-data-boundary.md` |
| API / 同步 / 鉴权 | `docs/04-api-and-sync.md` |
| 金币 / 宝石 / 旧游戏规则 | `docs/05-business-rules.md` |
| **任何 V2 可见 UI** | **`docs/12-island-life-design-system.md` + `docs/06-ui-guidelines.md`** |
| 开发 / 测试 | `docs/07-development-testing.md` |
| 部署 / 安全 | `docs/08-deployment-security.md` |

## 3. 领域边界

```text
饮食摄入 ≠ deficit ≠ 体重 ≠ 运动/活动
Island Life maintenance ≠ Legacy Game maintenance
```

- intake：`meals / meal_items`
- deficit：Legacy Game `daily_record_sides.deficit_kcal`
- weight：真实趋势 `weight_measurements`
- Legacy Game exercise：`daily_record_sides.exercise_minutes`
- V2 Life activity：`activity_entries`

关联展示不等于自动互相改值。

### 数据维护硬规则

Island Life 生活数据：

```text
meals / meal_items
mood_entries
sleep_records
activity_entries
weight_measurements
medicine_items
mailbox_letters
```

Legacy Game 游戏子项目：

```text
daily_records
daily_record_sides
exchange_categories
exchange_records
wallets
wallet_ledger
```

任何“清理本周测试数据 / 清生活记录 / Life import / Life restore”等普通 Life 操作，默认只能作用于 Island Life allowlist。

除非用户明确要求操作旧游戏，否则不得修改或删除任何 Legacy Game 表。禁止使用“所有最近创建的数据”这种跨域规则直接扫表。

代码级表边界定义：`lib/server/life-data-domains.ts`。

## 4. V2 视觉语言是强制规范

`docs/12-island-life-design-system.md` 是所有 V2 页面唯一主视觉规范。

任何 AI/开发工具不得在业务 PR 中自行改变已确认方向：

- 暖白/奶油底；
- 薄荷/青绿主识别；
- 柔黄/珊瑚/浅蓝点缀；
- 不使用大面积棕色；
- 低密度页面主题更明显，高密度数据页更克制；
- V2 使用 `app/island-life-tokens.css` 的 `--life-*` token；
- 业务页面优先 `components/ui/App*` / Pattern；
- 外部 GitHub UI 不能带入第二套色板、阴影、Button/Card/Input 体系。

### 当前 V2 主导航

```text
今日 / 饮食 / 日历 / 小窝 / 我的
```

### 今日

只显示心情 / 睡眠 / 活动；三者都必须有记录入口。心情必须使用彩色情绪圆脸，不用头像替代。

### 饮食

顶部 `我 / Ta`；一次只看一人；每餐左实物照片、右碳水/蛋白质/脂肪/总热量；每餐可编辑；底部当日汇总。

### 日历

双人心情月历；日期点击进入详情。

### 小窝

```text
体重 / 小信箱 / 家庭药箱 / 游戏机
```

体重也统一 `我 / Ta`；小信箱不用头像列表；游戏机只做游戏列表，本轮不新做 Legacy Game 详情 UI。

## 5. V2 UI 组件边界

当前共享 Pattern：

```text
AppPageShell
AppRoleSwitch
AppRecordRow
AppFeatureTile
AppNutritionBar
```

V2 token：

```text
app/island-life-tokens.css
```

新跨域 Pattern 应先进入 `components/ui`；业务专属组件留在对应 domain。

`/ui-lab` 只能用假数据，不得写 Supabase、不得调用真实 Life 写 API、不得触发 Legacy Game settlement。

## 6. UI 复用顺序

```text
已有 App*
-> animal-island-ui 已验证能力
-> 同视觉语言且许可允许的成熟 GitHub Pattern
-> 成熟 headless / 通用交互
-> 项目原创
```

从 0 写是最后手段。异风格项目只借逻辑/状态/布局，视觉必须归一。

## 7. 前端代码分层

- `components/home/*`：Legacy Game UI
- `components/life/*`：V2 Life UI
- `components/nutrition/*`：饮食 UI
- `components/ui/*`：项目视觉 adapter / cross-domain Pattern
- `HomeResourcesProvider`：Legacy Game 状态编排器，不扩成 V2 全局 Provider

饮食已完成 provider 解耦：

```text
DailyMealsPanel -> Legacy Game adapter
DailyMealsPanelCore -> provider-free nutrition UI
```

## 8. AI 写入原则

不是每个领域各造一套 AI。统一遵循：自然语言/图片 -> 草稿 -> 用户明确确认 -> 稳定 idempotency key -> 领域校验 -> restricted canonical write -> read-back。

`lib/ai/record-write-protocol.ts` 已预留：

```text
meal / mood / sleep / activity / weight / medicine
```

AI 不获得任意 SQL 权限。

`legacy_home` 是 Legacy Game 兼容入口，不属于普通 Island Life resource；只有用户明确要求旧游戏操作时才进入该流程。

## 9. Supabase / 安全

- Browser -> Next.js API -> server-only Supabase；
- secret 不进入浏览器；
- DDL 只通过新 migration；
- 已执行 migration 不回改；
- 多表写入考虑事务；
- anon/authenticated 不意外获得 server-only RPC；
- 真实药箱 Excel/库存不得提交到 GitHub migration。

## 10. Legacy Game

旧游戏完整保留：deficit、运动分钟、游戏体重快照、金币/宝石、钱包、成长地图、兑换商店与历史、成长日志、同步/备份。

它现在的产品身份是：**新程序「游戏」里的独立子项目“变瘦变美大作战”**。

V2 不顺手重写 Legacy Game，也不把 Life facts 自动转成全局排行榜；普通生活数据清理、导入和恢复也不得顺手修改 Legacy Game。

## 11. 开发验证

每阶段至少：

```text
npm run test
npm run lint
npm run build
```

可见 UI 还需 Vercel Preview 人工检查。未做视觉检查，不写“视觉已验证”。

## 12. Vercel 部署审批（强制）

仓库使用 `vercel.json` 关闭 Git 自动部署：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

必须遵守：

- Git push、PR、merge 不得自动触发 Vercel Preview 或 Production；
- 任何 Vercel Preview / Production 部署都必须先向用户申请；
- 只有用户明确回复“允许部署”或语义等价确认后，才可以手动触发部署；
- 未获批准时，可以继续提交代码、文档、运行 GitHub CI，但不得调用 Vercel 部署动作；
- 不得为了“顺便看看效果”自行部署；
- 部署审批是逐次授权，不视为永久授权。

## 13. 当前下一步

`docs/09-status-roadmap.md` 为唯一当前状态页。按该文档继续推进；任何需要 Vercel Preview / Production 的节点都必须先执行第 12 节审批流程。
