# 当前状态与 Roadmap

**状态日期：2026-09-01**

这份文件是“现在做到哪一步、下一步做什么”的唯一主状态页。

## 1. 当前阶段

项目已经从 localStorage-only MVP 演进为：

```text
成熟的游戏前端
+ localStorage 运行缓存
+ Supabase 云端主数据
+ Next.js 安全 API
+ 营养后端第一阶段
```

当前主动暂停新功能开发，先完成文档 / Skill / 项目治理。本次治理完成后再恢复功能开发。

## 2. 功能进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 每日双人打卡 | ✅ 完成 | deficit / exercise / weight snapshot |
| 游戏结算 | ✅ 完成 | 当前规则前端 service 计算 |
| 历史补录 / 编辑 / 删除 | ✅ 完成 | 会重算派生状态 |
| 月度成长地图 | ✅ 完成 | 周六到周五，跨月真实记录 |
| 成长日志 | ✅ 完成 | 查看和管理历史 |
| 兑换商店 | ✅ 完成 | 分类、兑换、历史记录 |
| JSON 备份 / 恢复 | ✅ 完成 | schemaVersion 1 兼容 |
| 周复盘 CSV | ✅ 完成 | 只导出 |
| animal-island-ui 视觉体系 | ✅ 完成 | App* wrapper 已建立 |
| Supabase 规范化游戏 schema | ✅ 生产可用 | 迁移 SQL 版本控制待回填 |
| 游戏云端读取 / 写入 | ✅ 完成 | Supabase-only 主路径 |
| 新设备首次连接保护 | ✅ 完成 | download-before-write |
| 公开 GitHub JSON 退出 | ✅ 当前代码完成 | GitHub cached view 清理待 Support |
| Nutrition schema | ✅ 完成 | meals/items/foods/aliases |
| Meal CRUD API | ✅ 完成 | transaction RPC，已 smoke test |
| Meal Web UI | ⏳ 未开始 | 下一业务功能 |
| ChatGPT “记上”持久化流程 | ⏳ 未开始 | 需以明确确认触发 |
| Weight schema | ✅ 完成 | `weight_measurements` 已存在 |
| Weight API / trend UI | ⏳ 未开始 | 之后开发 |
| Goal period schema | ✅ 完成 | UI 未实现 |
| 完整用户账号 / membership | ⏳ Later | 当前只共享密码/session |
| Server-authoritative 游戏结算 | ⏳ Later | 当前服务端保存兼容快照，不独立重算规则 |

## 3. 本次治理完成项

- [x] 重写 README，使项目当前架构一眼可见。
- [x] 重写 AGENTS / CLAUDE，移除“无后端/无数据库”旧假设。
- [x] 用持续维护 Skill 替换旧 UI migration Skill 思路。
- [x] 把 30+ 份重复 docs 合并为 9 份主文档 + 索引。
- [x] 将 GitHub JSON、future API 草案、future DB 草案从当前事实文档移除。
- [x] 把 live Supabase、Meal API、云端同步安全写入主文档。
- [x] 校正恢复奖励、heatmap、currency semantics 等旧文档错误。

## 4. P0 — 恢复功能开发前先做

### 4.1 回填 Supabase migrations

当前 production schema 可用，但仓库不能完整从空库复现早期 schema/RPC。

目标：

```text
建立 supabase/migrations（或明确等价目录）
-> 回填当前 production schema/functions/grants
-> 后续所有 DDL 版本化
```

这是当前最重要的工程治理技术债。

### 4.2 修正 schema default drift

当前：

```text
代码/production config deficitStreakDays = 5
DB column default = 7
```

应通过 migration 统一为 5，避免未来新 CoupleSpace 默认规则漂移。

### 4.3 建立当前 baseline 验证

在继续功能前跑一次完整：

```bash
npm run test
npm run lint
npm run build
```

记录已知失败（如果有），避免后续把历史问题误判为新功能回归。

## 5. P1 — 今日饮食 UI

目标：

- 按 fish/cat + 日期显示早餐/午餐/晚餐/加餐；
- 每餐显示 estimate 和区间，如 `520 kcal（480–570）`；
- 展开显示 food items；
- Web 手动新增 / 编辑 / 删除；
- 使用现有 `/api/meals`，不新造第二套数据结构；
- 移动端风格与当前 animal-island-ui 一致。

## 6. P2 — ChatGPT “记上”流程

目标行为：

```text
发食物图片/描述
-> ChatGPT 讨论估算
-> 用户修正
-> 用户明确“记上”
-> 构造 source=chatgpt meal payload
-> 带 idempotency key 写入
-> 成功后可查询确认
```

铁律：

- 未确认不写；
- 不把 intake 写成 deficit；
- 不碰游戏钱包；
- 重试不重复建餐。

## 7. P3 — 体重趋势

目标：

- `weight_measurements` CRUD/API；
- 当前体重和趋势折线；
- 同日多次测量策略；
- 旧每日打卡 weight snapshot 与 measurement 的事务性关联；
- 后续 daily overview 使用真实 measurement summary。

## 8. P4 — 统一每日总览

基于已有 views：

```text
daily_nutrition_summary
daily_weight_summary
partner_daily_overview
```

展示：

- 实际摄入；
- 体重；
- 游戏 deficit；
- 运动；
- 当日游戏奖励。

四个域并列展示，但不互相偷偷改值。

## 9. P5 / Later — 架构强化

### 游戏结算服务端权威化

前端仍可 preview，但服务端根据原始输入重算最终 reward/wallet。

### 真正用户身份

如果项目从两人私人应用扩展：

- User/Auth
- CoupleSpace membership
- per-user authorization
- RLS policy
- device/session revoke
- conflict strategy

### 清理兼容债

在有测试和生产迁移证明后：

- rename `reloadFromGitHub / syncToGitHub`；
- 移除 `/data/couple-data.json` proxy shim；
- 统一 cloud-session helper；
- 把 sync metadata storage 从组件/Provider 抽出。

不要在业务功能中顺手做这些迁移。

## 10. 外部事项

### GitHub cached views

GitHub Support `Clear Cached Views` 工单已创建。等待平台完成后：

1. 测试旧 sensitive commit/blob URL；
2. 应返回不可访问/404；
3. 记录完成时间到 CHANGELOG；
4. 再评估是否还有 Vercel 历史 deployment 残留。

## 11. “下一步是什么”的简单答案

在当前文档治理提交后：

```text
P0：把 Supabase schema/RPC migration 正式纳入仓库
↓
跑完整 baseline test/lint/build
↓
P1：开发今日饮食 UI
↓
P2：接 ChatGPT “记上”
↓
P3：体重趋势
```

除非用户改变优先级，以这个顺序推进。
