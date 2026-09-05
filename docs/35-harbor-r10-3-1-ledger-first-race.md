# Harbor R10.3.1 — Ledger-first Fast Wake Race

> 状态：代码与自动化测试已完成，CI Test / Lint / Build 全部通过；尚未部署 Production。目标是消除“RECEIPT 已完成但 Fast Wake 仍等待 Apps Script 后处理”的额外延迟。

## 1. 问题

R10.3 Production 速度验收确认：Worker 真正业务执行约 1.3 秒，RECEIPT 在 Fast Wake 开始后约 5.4 秒已 finalized，但 Vercel 仍会等待 Apps Script Web App 完整 HTTP 返回，造成用户侧额外等待。

真实验收时间点：

```text
Fast Wake 开始       ≈ 15:11:38.49Z
Worker 收到          = 15:11:42.557Z
RECEIPT 完成         = 15:11:43.892Z
Fast Wake HTTP 返回  ≈ 15:11:55Z
```

因此业务事实已经完成后，仍存在约 10 秒级无意义 transport 等待。

## 2. R10.3.1 实现

Fast Wake 进入 Apps Script 请求后，同时启动：

```text
A. Apps Script wake HTTP request
B. Supabase authoritative command ledger polling
```

当前 ledger race window：

- 最长 8 秒；
- 每 250ms 检查一次 authoritative ledger；
- 只接受 `status=succeeded|failed` 且 `receipt != null` 的 finalized 状态。

谁先给出确定结论就先结束当前 Fast Wake：

- ledger 先 finalized + receipt：立即返回 `200 receiptReady=true`；
- 此时 `ledgerFirst=true`、`reconciledFromLedger=true`；
- Vercel 中止继续等待当前 Apps Script HTTP client fetch；
- Apps Script 服务端已开始的业务/后处理不因此回滚；
- Apps Script 先正常返回：继续走现有 R10.3 路径；
- ledger 只有 processing / 无 receipt：绝不误判完成；
- race window 内 ledger 未 finalized：继续等待 worker，保持原 transport fallback。

## 3. Fast Wake 返回语义

Ledger-first 命中时：

```json
{
  "ok": true,
  "reconciledFromLedger": true,
  "ledgerFirst": true,
  "commandStatus": "succeeded | failed",
  "receiptReady": true
}
```

Fast Wake 仍不返回正式 receipt body。Project 后续必须按同一 `command_id` 精确读取 RECEIPT。

## 4. 安全边界

- Fast Wake token 仍然只是 transport wake 权限；
- Fast Wake 不返回业务 receipt 内容；
- RECEIPT 仍是正式业务结果；
- command_id 幂等不变；
- `processing`、无 receipt、ledger 查询异常均不能触发 ledger-first success；
- 只有 authoritative ledger finalized 后才允许 abort 当前 HTTP client wait；
- ledger race 不创建第二条 COMMAND，也不发送第二次 Fast Wake；
- 未来 MCP 不继承此 transport 优化。

## 5. 自动化测试与 CI

新增 `tests/server/drive-bridge-kick-race.test.ts`，覆盖：

- finalized ledger 先出现时，ledger 胜出并 abort worker client wait；
- ledger 未 finalized 时继续等待 worker；
- worker 自身失败时不伪造 ledger success。

已有 R10.3 lock policy 测试继续保留，防止 `locked` 场景重新引入第二次 wake。

PR #71 首轮 CI：

```text
Test  ✅
Lint  ✅
Build ✅
```

## 6. Production 验收标准

部署后用同一类只读 `life_query` 做真实速度复测，记录：

```text
Fast Wake request start
command ledger received_at
receipt finished_at
Fast Wake HTTP response time
ledgerFirst
receiptReady
wake count
```

目标：若 RECEIPT 在 Apps Script HTTP 完整结束前 finalized，则 Fast Wake 应接近 RECEIPT 完成时间返回，而不再等待 Apps Script snapshot / 后处理结束。
