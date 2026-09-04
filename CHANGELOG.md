# Changelog

只记录对理解产品状态有价值的里程碑，不记录每一次样式微调。

## 2026-09-04 — R8.8 缓存竞态收口与首屏无闪烁（PR #58）

- 为 stale-query 增加 request revision barrier：早于本地/read-back 写入启动的旧请求不再有资格覆盖新缓存；途中 invalidate 会从 mutation 之后重新读取。
- 月度 bundle 尚在飞行时发生心情写入，会显式失效旧快照，修复“刚改心情又被旧月历回滚”的竞态。
- 浏览器绘制前恢复最近确认的 cat/fish scope 与持久读缓存；服务端签名 Cookie 仍是唯一权限依据。
- 今日、饮食、日历移除用户可见的“第一次读取/正在确认账号”首屏文字；用稳定静态壳或月份网格承接首帧。
- 饮食数据未恢复时使用中性照片位，不再先画默认餐图再切实拍图。
- GitHub Actions：Test 221/221、Lint、Production Build 全部通过。
- Production deployment `dpl_2WsHTaUJZYLht9J8mRZZQ4vjKLSf` READY；`/`、`/food`、`/calendar` 均为 200，部署后最近 30 分钟无 error/fatal runtime log。
- 发布完成后已恢复 `vercel.json -> git.deploymentEnabled: false`，关闭提交未触发第二次部署。

## 2026-09-04 — R8.7 无阻塞启动与缓存一致性（PR #57）

- 移除全屏启动 splash 与 620ms/2.4s 人为等待，缓存页面立即显示、数据后台校验。
- 最近确认身份作为非授权本地 scope hint 跨应用重开保留；服务端签名 Cookie 仍是唯一权限依据。
- 启动预热改为 canonical day/meal/settings keys，月历与小窝数据延后，减少首屏重复 RPC 与资源争抢。
- 月度 bundle 同步生成月历缓存，避免同一月份并发读取 `get_life_month_moods` 和 `get_life_month_bundle`。
- Life 写入 read-back 后原子同步 day/month/bundle 缓存，修复月历心情先显示旧值的问题。
- 版本化餐食照片改为一年私有 immutable 缓存；餐食编辑/删除直接更新本地列表缓存。
- Test 216/216、Lint、Production Build 与 HTTP smoke 均通过；Production deployment `dpl_4n8MPK4N5ZQjNTCmj6gXLijYZupe` READY。
- Production 实机复查暴露出“旧 in-flight 请求可能覆盖新缓存”和剩余首屏占位闪烁，后续由 R8.8 收口。

## 2026-09-02 — P2.5 同日饮食与游戏记录关联

- 在现有「今日 → 饮食小记」中新增“当天合在一起看”，不新增第五个主 Tab。
- 按 `partnerKey + date` 把当天实际摄入与已有游戏 daily record 关联展示。
- 同一张 AppCard 现在显示：当天总摄入、可用总热量区间、游戏热量缺口、运动分钟和游戏体重快照。
- meals 存在但该日没有 `DailyRecord` 时明确显示“当天游戏记录未填写”；不会自动创建游戏记录。
- daily record 存在但没有 meals 时，实际摄入显示“未记录”。
- Meal API 加载失败时显示“暂未加载”，避免把错误状态误显示成 0 kcal。
- 新增 `lib/home/daily-overview-service.ts`，只读选择 `date + role` 对应游戏快照。
- 新增 `tests/home/daily-overview-service.test.ts`，覆盖角色选择、日期选择和缺失记录状态。
- P2.5 不新增数据库表、RPC 或 API，不扩大数据库权限面。
- 保持 `intake ≠ deficit ≠ weight ≠ exercise`；关联仅用于展示，不用 meals 自动覆盖游戏 deficit。
- 记录旧模型限制：`DailyRecord` 没有单侧 input-presence 标记，无法可靠区分“主动填写 0”和“旧模型补零”；当前不做启发式猜测。
- GitHub Actions Test / Lint / Build 全部通过；对应 Vercel production deployment 为 READY。
- P2.5 完成，下一阶段切换为 P3 体重趋势。

## 2026-09-02 — 角色映射纠正与饮食数据修正

- 根据真实使用反馈纠正 ChatGPT 饮食角色映射：**用户自己的饮食聊天 = `cat`（猫猫），鱼鱼的饮食聊天 = `fish`（鱼鱼）**。
- 修正此前因错误映射写到 `fish` 的旧照片餐食记录，并同步修正对应 `chatgpt:` 幂等键前缀。
- 食堂绿豆汤语境纠正为：默认按**完全无糖、汤水为主、少量绿豆**理解；除非用户另外说明加糖。
- 9 月 1 日对应晚饭记录已按无糖绿豆汤重新修正。

## 2026-09-02 — ChatGPT “记上”持久化流程

- 完成 P2：只有用户明确表达“记上”或等价保存意图后才持久化餐食；讨论、估算、修正不会自动写库。
- 新增 production migration `20260901162337_add_chatgpt_meal_persistence_rpc.sql`。
- 新增 service-only `create_chatgpt_meal_record`，强制 `source=chatgpt`、`status=confirmed`，要求 `chatgpt:` 幂等键并校验食物明细和热量合计。
- 同一幂等键使用事务 advisory lock，并继续复用 meals 唯一 idempotency 约束，避免网络/并发重试形成重复餐食。
- 新增 `get_chatgpt_meal_record`，用于写入结果不确定时按同一 key 查询确认。
- ChatGPT 使用用户已授权的 Supabase 连接能力调用受限 meal RPC，不把数据库 secret 或同步密码复制到聊天，也不新增公开写 API。
- production smoke test 验证首次创建、同 key 重试、按 key 读回和权限边界；测试 meal 已清理。
- P2 不改变游戏 deficit、运动、体重、钱包、金币、宝石或热力图。

## 2026-09-01 — 今日饮食 Web UI

- 在现有 `#today` notice-board 中新增「饮食小记」，不增加第五个底部 Tab。
- 按日期和 fish/cat 查询 Supabase 餐食，展示当天餐数、kcal 合计、餐型、区间、备注和来源。
- 食物明细可展开，支持手动新增 / 完整编辑 / 删除确认 / 软删除。
- 新增 `lib/nutrition/meal-client.ts`；浏览器只走同源 Meal API 和 HttpOnly cloud session。
- UI 继续复用现有 App* / animal-island-ui 视觉体系。

## 2026-09-01 — Supabase migration 与工程 baseline

- 将 production 中保留的原始 migration SQL 回填到 `supabase/migrations/`。
- 新增 `supabase/README.md`，明确数据库变更、RLS、service_role 和空库重建规则。
- 确认 `coin_deficit_streak_days` 默认值已经从 7 统一为当前规则的 5。
- 建立 GitHub Actions Test / Lint / Build baseline。
- 修复旧兑换记录兜底时间的跨时区测试问题。

## 2026-09-01 — 项目文档与 AI 规则治理

- 重审 README、AGENTS、CLAUDE、项目 Skill 和全部 docs。
- 将多套重复、过期的 refactor / migration / future-design 文档合并为当前主文档体系。
- 新增持续维护型 Codex Skill：`couple-better-game-maintainer`。
- 明确四个独立数据域：饮食摄入、游戏 deficit、体重、运动。
- 明确 Supabase 已是云端主数据源，公开 GitHub JSON 同步退出当前架构。

## 2026-09-01 — 饮食后端第一阶段

- 建立 `meals / meal_items / foods / food_aliases` 营养数据模型。
- 新增 `/api/meals` 与 `/api/meals/[id]` CRUD。
- 新增 meal payload 校验、热量区间、source、idempotency key 支持。
- 多表写入采用 Supabase 事务 RPC。
- 完成新增 → 查询 → 修改 → 软删除数据库冒烟验证。

## 2026-09-01 — Supabase 成为唯一云端主数据源

- 游戏快照迁移到规范化 Supabase 表。
- `/api/home-data` / `/api/save-data` 接入 Supabase RPC。
- 新增 cloud session 和新设备首次写入保护。
- 停止 GitHub JSON 镜像写入并删除当前 `public/data/couple-data.json`。
- 重写可达 Git 历史；GitHub Support 继续处理旧 dangling commit cached views。

## 2026-05 至 2026-08 — Web MVP 与游戏核心

- 完成双人每日记录、历史补录 / 编辑 / 删除。
- 完成金币 / 宝石、情侣奖励、钱包回算和周统计。
- 完成成长地图、成长日志、兑换商店和兑换记录。
- 完成 AppDataStore、localStorage、JSON 备份恢复、CSV 复盘。
- 完成 animal-island-ui 视觉体系和 `components/ui/App*` wrapper。
