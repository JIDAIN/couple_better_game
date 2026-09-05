# Harbor Fast Wake 假阴性修复与 Production 验收记录（2026-09-05）

> 最终状态：Production 已部署，专项回归通过。

## 问题

Production 最终回归中曾出现一次：业务命令已成功写入 RECEIPT / Supabase，但 `/api/drive-bridge/kick` 因 Apps Script 返回 `ok=false` 最终给调用方 502 `worker wake failed`。

这属于 Harbor transport 假阴性，不是业务失败。

## 根因层级

- 层级：Harbor Adapter / transport。
- 非 AI Access Core 业务 contract 问题。
- 非 Supabase 正式数据写入问题。

Apps Script 的返回值还包含 STATE_* 镜像刷新、并发锁等非权威步骤；这些步骤返回 `ok=false` 或 `locked` 时，command 本身可能已经由 Worker 完成并在 `life_drive_bridge_commands` authoritative ledger 写入最终 receipt。

## 修复原则

Fast Wake 不再把 Apps Script 的 `ok` 当作唯一成功依据。

顺序改为：

1. 唤醒 Apps Script；
2. 若 worker 正常 `ok=true`，直接成功；
3. 若 worker `ok=false` / HTTP 异常 / 并发锁等 transport 异常，则读取 Supabase authoritative command ledger；
4. 若同一 `actor + command_id` 已为 `succeeded` 或 `failed`，且 receipt 已存在，则说明命令已经完成投递和处理，Fast Wake 返回 HTTP 200；
5. 返回中标记 `reconciledFromLedger=true` 与 `commandStatus`；
6. 只有 ledger 仍为 `processing` / 不存在时，才继续安全 retry；
7. retry 后仍未 finalized 才返回真实 transport error。

## 为什么 commandStatus=failed 也可返回 Fast Wake 200

Fast Wake 的职责是“把命令送到 worker 并推动处理”，不是伪装业务结果。

如果 ledger 已经写入 `failed + receipt`，说明 transport 已完成，业务失败原因应由 RECEIPT 告诉 AI / 用户。此时再返回 Fast Wake 502 会把“业务校验失败”误报成“桥没唤醒”。

因此：

```text
HTTP / Fast Wake 200 = transport 已完成
RECEIPT ok=true       = 业务成功
RECEIPT ok=false      = 业务已处理但需要追问/校验失败
```

这三者不能混为一谈。

## 安全边界

- 不重新执行已 finalized 的业务 mutation；
- `command_id + authoritative ledger` 继续提供幂等保护；
- `processing` / 无 receipt 绝不被当作成功；
- ledger 查询本身失败时，不掩盖原 transport failure，继续沿用保守失败逻辑；
- 业务失败仍由 RECEIPT 原样表达，不伪装为成功；
- Harbor 仍只是 Adapter，未来 MCP 不需要继承 Fast Wake。

## 自动化验证

PR #69 新增 finalized ledger 语义测试：

- `succeeded + receipt` → finalized；
- `failed + receipt` → finalized；
- `processing` → 非 finalized；
- finalized status 但 receipt 为空 → 非 finalized；
- ledger 不存在 → 非 finalized。

PR #69 CI：

- Test ✅
- Lint ✅
- Build ✅

## Production 部署

用户明确授权后执行一次受控 Production 部署。

- Production deployment：`dpl_9R7gRSwpvTw7Lgpu3X8Ehpja7mo9`
- 状态：READY
- 正式域名：`https://couple-better-game.vercel.app`
- 正式域名首页：HTTP 200
- 本轮 Production 部署数量：1
- 部署完成后已恢复 `vercel.json -> git.deploymentEnabled=false`
- 恢复关闭自动部署的提交没有产生第二次 Production deployment

## Production 专项回归

### 1. 成功命令 + worker locked 的 reconciliation

通过 Cat Bridge 提交只读 `life_query(day)`。

真实 RECEIPT：

- `ok = TRUE`
- command ledger：`succeeded`

Fast Wake 在 Apps Script 并发锁场景返回：

```text
HTTP 200
ok = true
reconciledFromLedger = true
commandStatus = succeeded
skipped = locked
```

结论：即使 worker transport 层返回 `locked`，只要 authoritative ledger 已 finalized，用户侧不再得到错误的 502。

### 2. 业务失败 + transport 成功的分离

故意提交缺少重量的体重写入：`life_mutate(weight, data={})`。

真实 RECEIPT：

```text
ok = FALSE
error = 需要向用户确认：要记录多少公斤？
```

command ledger 正确 finalized 为 `failed`。

Fast Wake 返回：

```text
HTTP 200
ok = true
reconciledFromLedger = true
commandStatus = failed
skipped = locked
```

结论：transport 正确识别为“命令已送达并处理”，业务层继续通过 RECEIPT 告诉 AI 自然追问用户，不再误报“桥失败”。

### 3. Production 运行状态

专项回归后检查 Vercel 最近 30 分钟 Runtime Errors：

`No runtime errors found`。

## 最终结论

Harbor Fast Wake 的“业务已完成但偶发 502 假阴性”已完成 Production 修复与真实回归。

当前边界为：

```text
COMMANDS / Apps Script / Fast Wake 负责 transport
Supabase command ledger              负责 authoritative execution status
RECEIPTS                             负责业务结果
AI Access Core                       负责业务 contract / normalization / authorization
```

未来 MCP 替换 Harbor 时，只替换 transport Adapter；authoritative 业务层和 AI Access Core 保持不变。
