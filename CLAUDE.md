# CLAUDE.md

本文件只作为 Claude Code / VSCode AI 的入口，不重复维护项目事实。

## 开始前

必须依次阅读：

1. `AGENTS.md`
2. `README.md`
3. `docs/README.md`
4. `docs/09-status-roadmap.md`
5. 当前任务对应的主文档和源码

如果这里与 `AGENTS.md` 冲突，以 `AGENTS.md` 为准。

## 当前项目提醒

- 项目已经有 Vercel API 和 Supabase，不要再按“纯前端、无数据库”假设工作。
- `localStorage` 是运行缓存，不是唯一云端真相来源。
- 饮食摄入、游戏 `deficit`、体重、运动必须分域。
- Supabase secret 只能服务端使用。
- 旧 GitHub public JSON 同步已经废弃，禁止恢复。
- 游戏代码存在 currency semantics legacy 名称，改金币/宝石逻辑前必须阅读 `docs/05-business-rules.md`。
- UI 已完成 animal-island-ui 体系迁移，当前应维护 `components/ui/App*` wrapper，而不是重复执行旧迁移流程。

## 完成任务后

用中文说明：

1. 修改摘要
2. 修改文件
3. 验证方式及结果
4. 未运行的检查及原因
5. 风险 / 未完成事项
6. 是否需要同步 `CHANGELOG.md` 和 `docs/09-status-roadmap.md`
