# Supabase 数据库版本管理

本目录保存项目 Supabase PostgreSQL 的数据库变更历史。

## 目录规则

- `migrations/` 中的文件按 Supabase migration version 排序执行。
- 2026-09-01 首次把 production 的 `supabase_migrations.schema_migrations` 原始 SQL 回填到仓库；版本号和 migration 名与 production 保持一致。
- 已经在 production 执行过的历史 migration **不可回头修改**。需要修正时新增 migration。
- 数据库 schema、function、view、trigger、grant、RLS 等变更都必须进入 migration，禁止只在 production 手工修改后不落库。

## 当前安全模型

当前浏览器不直接访问 Supabase：

```text
Browser -> Next.js API -> server-only Supabase secret/service_role -> PostgreSQL
```

public 基础表启用 RLS，当前不向 `anon` / `authenticated` 开放业务 policy；需要的 RPC/grant 仅给服务端 `service_role`。

不要提交：

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
任何真实密码、token、个人备份数据
```

## 从空数据库重建

数据库结构的重建顺序是：

1. 在空 Supabase/PostgreSQL 项目中按文件名顺序执行 `migrations/*.sql`；
2. 验证 table / view / function / trigger / RLS / grants；
3. 再单独恢复或导入业务数据。

migration 只负责数据库结构和规则，不内嵌当前情侣空间的真实业务数据。**schema 可重建不等于 production 数据备份。**

## 历史默认值说明

`20260901010632_create_core_v1_schema.sql` 是当时真实执行的历史 SQL，其中 `coin_deficit_streak_days` 初始默认值为 7。

后续 `20260901055415_align_coin_deficit_streak_default.sql` 将默认值正式统一为当前业务规则的 5。不要为了让第一份文件“看起来正确”而改写历史。
