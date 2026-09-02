# Changelog

只记录对理解产品状态有价值的里程碑，不记录每一次样式微调。

## 2026-09-02 — 角色映射纠正与 P2.5 同日关联

- 根据真实使用反馈纠正 ChatGPT 饮食角色映射：**用户自己的饮食聊天 = `cat`（猫猫），鱼鱼的饮食聊天 = `fish`（鱼鱼）**。
- 修正此前因错误映射写到 `fish` 的旧照片餐食记录，并同步修正对应 `chatgpt:` 幂等键前缀。
- 明确新的 P2.5：按 `partnerKey + date` 把同一天的餐食总摄入/明细与已有 daily record（deficit / exercise / weight snapshot）关联展示。
- P2.5 只做读取/展示关联，不根据 meals 自动覆盖游戏 deficit；任一侧缺失时明确显示“未记录”。
- 根据用户长期饮食语境补充估算规则：食堂甜绿豆汤按加糖版本估算，不按无糖绿豆水默认处理；具体摄入仍结合吃前/吃后照片和实际饮用量判断。
- Roadmap 调整为 P2.5 → P3 体重趋势 → P4 完整每日总览。

## 2026-09-02 — ChatGPT “记上”持久化流程

- 完成 P2：ChatGPT 只有在用户明确表达“记上”或等价保存意图后才持久化餐食；讨论、估算、修正不会自动写库。
- 新增 production migration `20260901162337_add_chatgpt_meal_persistence_rpc.sql`。
- 新增 service-only `create_chatgpt_meal_record`，强制 `source=chatgpt`、`status=confirmed`，要求 `chatgpt:` 幂等键并校验食物明细和热量合计。
- 同一幂等键使用事务 advisory lock，并继续复用现有 meals 唯一 idempotency 约束，避免网络/并发重试形成重复餐食。
- 新增 `get_chatgpt_meal_record`，用于写入结果不确定时按同一 key 查询确认。
- ChatGPT 使用用户已授权的 Supabase 连接能力调用受限 meal RPC，不把 `SUPABASE_SECRET_KEY`、service role key 或同步密码复制到聊天，也不新增公开写 API。
- 新增 `lib/nutrition/chatgpt-meal-protocol.ts` 与对应 Vitest，固化 `chatgpt:` key、source/status 和 item-total 约束。
- production smoke test 验证：首次创建成功、同 key 重试返回同一 meal ID、按 key 读回成功、service_role 可执行、anon/authenticated 不可执行；测试 meal 已硬删除，剩余 0 条。
- 角色映射现已纠正为：用户饮食聊天映射 `cat`，鱼鱼饮食聊天映射 `fish`；上下文不明确时不得猜测后写入。
- P2 不改变游戏 deficit、运动、体重、钱包、金币、宝石或热力图。

## 2026-09-01 — 今日饮食 Web UI

- 在现有 `#today` notice-board 中新增「饮食小记」，不增加第五个底部 Tab。
- 按日期和 fish/cat 查询 Supabase 餐食，展示当天餐数和 kcal 合计。
- 餐食卡片支持早餐 / 午餐 / 晚餐 / 加餐 / 其他、时间、中心估算、上下限、备注和来源。
- 食物明细可展开，显示份量、估重、单品 kcal 区间和已有宏量营养数据。
- 新增手动餐食新增 / 完整编辑 / 删除确认 / 软删除 UI。
- 新增 `lib/nutrition/meal-client.ts`，浏览器只走现有同源 meal API 和 HttpOnly cloud session，不直接访问 Supabase。
- 新增 meal browser client 测试，并修正 React effect 初始化/加载方式以符合当前 lint 规则。
- UI 继续复用 `AppSectionPanel / AppCard / AppButton / AppInput / AppTextarea / AppModal / AppRoleAvatar` 与 animal-island-ui `Title`，未建立第二套视觉 primitive。
- 页面持续明确：实际摄入不会自动修改游戏 deficit、金币、宝石或热力图。
- P1 完成；下一阶段为 ChatGPT 明确“记上”后的持久化流程。

## 2026-09-01 — Supabase migration 与工程 baseline 完成

- 将 production `supabase_migrations.schema_migrations` 中保留的 12 条原始 migration SQL 回填到 `supabase/migrations/`，版本号与名称保持一致。
- 新增 `supabase/README.md`，明确数据库变更、RLS、service_role 和空库重建规则。
- 确认 `coin_deficit_streak_days` 已通过历史 migration 将默认值从 7 统一为当前规则的 5。
- 建立 GitHub Actions Test / Lint / Build baseline。
- 修复旧兑换记录缺失时间兜底的跨时区测试问题。
- 当前 baseline：`npm run test`、`npm run lint`、`npm run build` 全部通过。
- 工程治理 P0 完成。

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
- 当时饮食 UI 尚未开始；后续已在同日完成 P1 Web UI。

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