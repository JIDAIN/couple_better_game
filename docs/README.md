# 项目文档索引

`docs/` 顶层只保存**当前有效、需要持续维护**的项目文档。历史实现、阶段验收和迁移过程统一放入 [`archive/`](archive/README.md)，不再与当前事实文档混在一起。

目标是让第一次接手的人不用翻历史对话，就能回答：产品是什么、代码怎么工作、数据在哪里、业务规则是什么、AI 如何接入、现在做到哪一步。

## 建议阅读顺序

| 文档 | 回答的问题 |
|---|---|
| [`01-product.md`](01-product.md) | 产品给谁用、有哪些主要模块和用户流程？ |
| [`02-architecture.md`](02-architecture.md) | 浏览器、MCP、AI Access Core、API 与 Supabase 如何连接？ |
| [`03-data-model.md`](03-data-model.md) | 哪些是事实数据，各生活域如何建模和隔离？ |
| [`04-api-and-sync.md`](04-api-and-sync.md) | 当前 API、session、缓存和同步保护如何工作？ |
| [`05-business-rules.md`](05-business-rules.md) | Legacy Game 与生活系统的核心业务规则是什么？ |
| [`06-ui-guidelines.md`](06-ui-guidelines.md) | 当前页面与组件维护约束是什么？ |
| [`07-development-testing.md`](07-development-testing.md) | 新功能放哪里、怎么测试、怎么更新文档？ |
| [`08-deployment-security.md`](08-deployment-security.md) | Vercel / Supabase 如何部署，密钥和隐私如何保护？ |
| [`09-status-roadmap.md`](09-status-roadmap.md) | Production 当前状态、已知边界和下一步是什么？ |
| [`10-v2-life-redesign.md`](10-v2-life-redesign.md) | 为什么生活系统是主产品、旧游戏如何保留？ |
| [`11-ai-write-architecture.md`](11-ai-write-architecture.md) | AI 如何统一、安全地查询和写入生活数据？ |
| [`12-island-life-design-system.md`](12-island-life-design-system.md) | V2 可见 UI 的主视觉规范是什么？ |

## 当前专项文档

| 文档 | 主题 |
|---|---|
| [`13-meal-photo-storage.md`](13-meal-photo-storage.md) | 餐食照片 Storage、压缩与绑定 |
| [`14-wechat-reminders.md`](14-wechat-reminders.md) | Supabase → PushPlus 微信提醒 |
| [`17-auth-and-pairing.md`](17-auth-and-pairing.md) | 固定 Cat / Fish 登录、session 与权限边界 |
| [`26-ai-access-core-principles.md`](26-ai-access-core-principles.md) | AI Access Core 长期架构原则 |
| [`28-ai-natural-language-contract.md`](28-ai-natural-language-contract.md) | 自然语言 normalization / clarification contract |
| [`44-meal-draft-before-after-contract.md`](44-meal-draft-before-after-contract.md) | 新 meal 的草稿确认与餐前/餐后差分 |
| [`45-r11-5-meal-nutrition-photo-display.md`](45-r11-5-meal-nutrition-photo-display.md) | 当前营养字段、照片展示与单图持久化细节 |
| [`46-harbor-mcp-project-instructions.md`](46-harbor-mcp-project-instructions.md) | Harbor Cat / Fish 当前 MCP Project Instructions |
| [`47-harbor-instructions-maintenance.md`](47-harbor-instructions-maintenance.md) | Project Instructions 的维护规则 |
| [`48-life-legacy-game-data-boundary.md`](48-life-legacy-game-data-boundary.md) | Island Life 与旧版“变瘦变美大作战”游戏子项目的数据隔离与维护边界 |

## 文档事实优先级

资料冲突时按以下顺序确认：

1. 已验证的 Production 行为 / Supabase 当前 schema；
2. 当前 `main` 代码；
3. `docs/` 顶层当前主文档；
4. [`docs/archive/`](archive/README.md)；
5. Git 历史和旧聊天记录。

尚未部署的代码或 migration 必须明确写成“待部署 / 待执行”，不能冒充 Production 已上线。

## 文档维护原则

- 一个主题只保留一个当前主文档；
- `docs/` 顶层不放一次性部署记录、阶段验收报告、临时调研或已经完成的 migration checklist；
- 稳定结论应合并回对应主文档；
- `CHANGELOG.md` 记录“发生了什么”，`09-status-roadmap.md` 记录“现在在哪、下一步是什么”；
- API、schema、权限、产品规则或 UI contract 改变时，同一批修改同步更新对应主文档；
- 历史文档不得反向覆盖当前事实。

根目录另外有：

- `README.md`：项目快速入口；
- `AGENTS.md`：AI / 自动化开发工具的工程规则；
- `CLAUDE.md`：Claude Code 薄入口；
- `CHANGELOG.md`：里程碑事实记录；
- `.codex/skills/couple-better-game-maintainer/SKILL.md`：Codex 持续维护 Skill。
