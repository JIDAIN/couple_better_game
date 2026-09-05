# Harbor R10.3.1 — Ledger-first Fast Wake Race

> 状态：设计记录，目标是消除“RECEIPT 已完成但 Fast Wake 仍等待 Apps Script 后处理”的额外延迟。

## 1. 问题

R10.3 Production 速度验收确认：Worker 真正业务执行约 1.3 秒，RECEIPT 在 Fast Wake 开始后约 5.4 秒已 finalized，但 Vercel 仍会等待 Apps Script Web App 完整 HTTP 返回，造成用户侧额外等待。

## 2. 决策

Fast Wake 同时启动：

```text
A. Apps Script wake request
B. Supabase authoritative command ledger polling
```

谁先给出确定结论就先结束当前 Fast Wake：

- ledger 先 finalized + receipt：立即返回 `200 receiptReady=true`；停止等待当前 HTTP client fetch；
- Apps Script 先正常返回：按现有 R10.3 路径处理；
- ledger 仍 processing：不把它误判完成；
- 真正 transport 失败仍保留错误语义。

## 3. 不改变的边界

- Fast Wake 不返回 receipt body；
- RECEIPT 仍是正式业务结果；
- command_id 幂等不变；
- Apps Script 后处理可以继续服务器端执行；Vercel 只是停止等待其 HTTP response；
- 未来 MCP 不继承此 transport 优化。
