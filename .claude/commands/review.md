# Review Change

请 review 当前改动，优先发现会导致真实数据、规则或安全回归的问题。

## 必读

- `AGENTS.md`
- 当前领域主文档
- 相关 diff / schema / tests

## 重点检查

- intake / deficit / weight / exercise 是否混域
- game source-of-truth 与 derived data 是否混淆
- legacy coin/gem semantics 是否被误解
- Provider/UI 是否重新承担纯业务规则
- Supabase secret 是否可能进客户端
- API 是否保留 auth/session guard
- 新设备保护 / dirty reload guard 是否破坏
- 多表写入是否原子
- RLS/grants 是否意外开放
- idempotency 是否足够
- migration 是否版本化
- 测试是否覆盖回归
- docs/roadmap 是否与实现一致

按严重度输出 findings；没有实质问题时也明确说明剩余测试风险。

$ARGUMENTS
