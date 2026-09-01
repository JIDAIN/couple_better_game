# 项目文档索引

这里保存**当前有效**的长期项目文档。目标是让第一次接手的人不需要阅读历史对话或几十份迁移报告，也能回答：产品是什么、代码怎么工作、数据在哪里、规则是什么、目前做到哪一步、下一步做什么。

## 阅读顺序

| 文档 | 回答的问题 |
|---|---|
| [`01-product.md`](01-product.md) | 这个产品给谁用？有哪些功能和用户流程？ |
| [`02-architecture.md`](02-architecture.md) | 浏览器、Provider、API、Supabase 如何连接？ |
| [`03-data-model.md`](03-data-model.md) | 哪些是事实数据？表怎么分？四个健康数据域如何隔离？ |
| [`04-api-and-sync.md`](04-api-and-sync.md) | 当前真实 API、cloud session、同步保护怎么工作？ |
| [`05-business-rules.md`](05-business-rules.md) | 金币、宝石、热力图、周规则到底是什么？ |
| [`06-ui-guidelines.md`](06-ui-guidelines.md) | animal-island-ui 和项目 wrapper 应该怎么用？ |
| [`07-development-testing.md`](07-development-testing.md) | 新功能放哪里、怎么测试、怎么更新文档？ |
| [`08-deployment-security.md`](08-deployment-security.md) | Vercel/Supabase 怎么部署，密钥和隐私如何保护？ |
| [`09-status-roadmap.md`](09-status-roadmap.md) | 已完成、进行中、下一步、技术债是什么？ |

根目录另外有：

- `README.md`：给人看的快速入口。
- `AGENTS.md`：所有 AI / 自动化开发工具的工程规则。
- `CLAUDE.md`：Claude Code 薄入口。
- `CHANGELOG.md`：里程碑事实记录。
- `.codex/skills/couple-better-game-maintainer/SKILL.md`：Codex 持续维护 Skill。

## 文档事实优先级

当资料冲突时，按以下顺序确认：

1. 已验证的生产行为 / Supabase 当前 schema；
2. 当前 `main` 代码；
3. 本目录主文档；
4. Git 历史中的旧文档 / 旧聊天记录。

发现主文档与真实实现不一致时，修代码或修文档，但不能保持“两个版本都算对”。

## 文档维护原则

- **一个主题只保留一个主文档。**
- 重构 / 迁移过程报告不作为长期事实源；稳定结论合并进主文档。
- `CHANGELOG` 记录“发生了什么”，roadmap 记录“现在在哪、下一步是什么”。
- API、schema、规则变化必须同步对应文档。
- 临时 audit、调研和迁移 checklist 优先放 issue / PR / 对话，不继续堆在 `docs/`。

## 历史文档

2026-09-01 前仓库曾同时存在 product brief、requirements、user flows、两套 architecture/testing/deployment 文档、GitHub JSON 同步说明以及多份 UI migration audit/report/rollback 文档。

这些内容已合并到当前主文档并从主分支删除，以免继续误导。需要追溯迁移过程时，请查看 Git 历史。
