# 开发与测试指南

## 1. 开发原则

```text
先确认领域
-> 读当前主文档和源码
-> 最小改动
-> 补测试
-> 验证
-> 更新 roadmap/changelog
```

不要因为旧文档说“未来”就重复实现已经存在的 Supabase/API。

## 2. 文件放置

| 内容 | 位置 |
|---|---|
| 页面 / API | `app/` |
| 游戏业务 UI | `components/home/` |
| 通用项目 UI wrapper | `components/ui/` |
| 游戏类型 / 规则 / service | `lib/home/` |
| 营养类型 / validation | `lib/nutrition/` |
| 服务端 auth / Supabase | `lib/server/` |
| 游戏测试 | `tests/home/` |
| 营养测试 | `tests/nutrition/` |
| 长期文档 | `docs/` 主文档 |

## 3. 游戏功能开发

### 规则变化

优先修改：

```text
lib/home/settlement-rules.ts
lib/home/home-stat-service.ts
lib/home/daily-record-service.ts
```

必须检查：

- 边界值；
- 历史编辑回算；
- wallet；
- exchange；
- heatmap；
- currency semantics。

### 数据结构变化

如果修改 `DailyRecord / ExchangeRecord / AppDataSnapshot`：

1. `lib/home/types.ts`；
2. snapshot conversion；
3. state restore；
4. import/export / legacy migration；
5. Supabase compatibility RPC；
6. tests；
7. docs。

## 4. 营养功能开发

业务类型和 validation 放 `lib/nutrition`，API route 不应堆复杂 parse 逻辑。

多表 meal 写入继续使用 transaction RPC。

修改 payload 时同时更新：

```text
meal-service.ts
supabase-nutrition.ts
RPC
app/api/meals
nutrition tests
docs/03 + docs/04
```

## 5. 体重功能开发

趋势源是 `weight_measurements`。

若旧“记录今天”继续允许录入体重，需要明确：

- game snapshot 如何写；
- measurement 如何写；
- 两者事务失败怎么处理；
- 同一天重复测量如何展示。

不要仅为了画图直接从 daily_record_sides 当长期趋势唯一源。

## 6. Supabase 开发

### DDL

必须通过 migration。

新增 migration 需要包含：

- table/function/view 变化；
- constraint/index；
- RLS；
- grants/revokes；
- 必要 rollback/compatibility 考量。

### RPC

适合使用 RPC：

- 多表原子写入；
- server-only transaction；
- 兼容 snapshot 映射。

不要为了简单单表 query 无条件堆 RPC。

### 权限

当前 server-only 模式下，新增 server RPC 默认检查：

```text
service_role execute = yes（如果 API 需要）
anon execute = no
authenticated execute = no
```

如果未来切到用户 Auth，此策略必须重新设计，不能直接沿用。

## 7. localStorage

业务 snapshot 走 `AppDataStore`。

现存同步 metadata/password 直接 storage 访问只视为 compatibility debt。

新模块需要浏览器持久化时，应先明确：

- 是业务数据还是 UI 临时状态？
- 是否应进入 Supabase？
- 是否只适合作为 cache？

## 8. 测试命令

```bash
npm run test
npm run test:watch
npm run lint
npm run build
```

## 9. 当前测试覆盖

### `tests/home/`

当前主要覆盖：

- `settlement-rules.test.ts`
- `daily-record-service.test.ts`
- `home-stat-service.test.ts`
- `home-state-service.test.ts`
- `exchange-service.test.ts`
- `app-data-store.test.ts`
- `memory-app-data-store.test.ts`
- `data-import-export.test.ts`
- `heatmap-grid.test.ts`
- `sync-state-service.test.ts`
- `save-data-route.test.ts`
- `daily-quote.test.ts`

### `tests/nutrition/`

- meal payload / query validation。

## 10. 测试优先级

```text
业务规则
> 数据一致性 / migration
> service
> sync guard / API validation
> UI 交互
> 纯视觉快照
```

当前项目不应因为 UI 高频变化，让大量脆弱样式测试取代业务测试。

## 11. 什么时候必须补测试

### Game

- 阈值 / bonus / recovery / week 规则；
- wallet replay；
- DailyRecord 结构；
- historical edit/delete；
- snapshot / import / currency migration；
- heatmap date；
- sync guard。

### Nutrition

- 新 meal type/source/status；
- calorie range；
- idempotency；
- validation；
- transaction RPC 行为。

### Cloud

- first-device protection；
- wrong password；
- missing/invalid session；
- dirty-local overwrite guard。

## 12. DB smoke test

数据库 / RPC 改动除单元测试外，至少验证：

```text
create
read
update
soft delete / delete
permission
cleanup test data
```

不要把 smoke test 数据留在 production。

## 13. 提交前检查

代码改动能运行时：

```bash
npm run test
npm run lint
npm run build
```

另外人工确认：

```text
[ ] 没有 secret 暴露
[ ] 没有恢复 GitHub public data
[ ] 没有混淆 intake/deficit/weight/exercise
[ ] 派生数据可回算
[ ] Supabase 权限符合当前 server-only 模式
[ ] 文档与 roadmap 已同步
```

只改文档 / Skill 时，不要求为了形式跑完整 build；应检查链接、路径、代码事实和 markdown 结构，并在总结里说明没有运行代码检查。
