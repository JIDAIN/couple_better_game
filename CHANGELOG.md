# Changelog

只记录对理解产品状态有价值的里程碑，不记录每一次样式微调。

## 2026-09-01 — Supabase migration 与工程 baseline 完成

- 将 production `supabase_migrations.schema_migrations` 中保留的 12 条原始 migration SQL 回填到 `supabase/migrations/`，版本号与名称保持一致。
- 新增 `supabase/README.md`，明确数据库变更、RLS、service_role 和空库重建规则。
- 确认 `coin_deficit_streak_days` 已通过历史 migration 将默认值从 7 统一为当前规则的 5。
- 建立 GitHub Actions Test / Lint / Build baseline。
- 修复旧兑换记录缺失时间兜底的跨时区测试问题。
- 当前 baseline：`npm run test`、`npm run lint`、`npm run build` 全部通过。
- 工程治理 P0 完成，下一业务阶段为今日饮食 UI。

## 2026-09-01 — 项目文档与 AI 规则治理

- 暂停功能开发，重新审查 README、AGENTS、CLAUDE、项目 Skill 与全部 docs。
- 将多套重复、过期的 refactor / migration / future-design 文档合并为当前有效的主文档体系。
- 新增持续维护型 Codex Skill：`couple-better-game-maintainer`。
- 明确四个独立数据域：饮食摄入、游戏 deficit、体重、运动。
- 明确 Supabase 已是云端主数据源，GitHub JSON 同步只属于历史方案。

## 2026-09-01 — 饮食后端第一阶段

- 建立 `meals / meal_items / foods / food_aliases` 营养数据模型。
- 新增 `/api/meals` 与 `/api/meals/[id]` CRUD。
- 新增 meal payload 校验、热量区间、source、idempotency key 支持。
- 多表写入采用 Supabase 事务 RPC。
- 完成新增 → 查询 → 修改 → 软删除的数据库冒烟验证。
- 饮食 UI 尚未开始。

## 2026-09-01 — Supabase 成为唯一云端主数据源

- 现有游戏快照迁移到规范化 Supabase 表。
- `/api/home-data` / `/api/save-data` 接入 Supabase RPC。
- 新增 cloud session 和新设备首次写入保护。
- 手机端完成真实云端读取、写入验证。
- 停止 GitHub JSON 镜像写入并删除当前 `public/data/couple-data.json`。
- 重写可达 Git 历史，GitHub Support 正在处理旧 dangling commit cached views。
- `.gitignore` 阻止旧公开数据文件再次进入 Git。

## 2026-05 至 2026-08 — Web MVP 与游戏核心

- 完成双人每日记录、历史补录/编辑/删除。
- 完成金币/宝石、情侣奖励、钱包回算和周统计。
- 完成成长地图、成长日志、兑换商店和兑换记录。
- 完成 AppDataStore、localStorage、JSON 备份恢复、CSV 复盘。
- 完成 animal-island-ui 视觉体系和 `components/ui/App*` wrapper。
- 早期曾使用公开 GitHub JSON 做跨设备同步；该方案已于 2026-09-01 完全退出当前架构。
