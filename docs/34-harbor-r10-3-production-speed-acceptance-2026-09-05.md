# Harbor R10.3 Production 速度验收（2026-09-05）

> Production deployment: `dpl_353MRNWaGLz7Z7K73BRYX5LAn69K`
> 状态：R10.3 已上线；业务执行快，但验收发现 Fast Wake HTTP 仍被 Apps Script 后处理拖长。

## 1. 部署

- 仅 1 次 Production deployment；
- deployment READY；
- 正式域名 alias 已切换；
- `vercel.json` 部署后恢复 `git.deploymentEnabled=false`。

## 2. 速度实测

第二次独立只读验收命令：`life_query(resource=day)`。

关键时间：

```text
Fast Wake request start (Vercel request id timestamp) ≈ 15:11:38.490Z
Worker received_at                              = 15:11:42.557Z
RECEIPT finished_at                            = 15:11:43.892Z
Fast Wake response Date header                 ≈ 15:11:55Z
```

得到：

- Worker 业务执行：约 1.335 秒；
- Fast Wake 请求开始 → RECEIPT finalized：约 5.402 秒；
- Fast Wake HTTP 返回明显晚于 RECEIPT finalized，额外等待约十余秒。

## 3. 结论

当前主瓶颈已经不是 AI Access Core、Supabase 或 life_query，而是：

```text
Apps Script doPost
→ command 已执行并写 RECEIPT
→ 继续 snapshot / post-processing
→ Vercel invokeWorker 仍 await 整个 Apps Script HTTP response
→ Project 不能立刻进入 exact RECEIPT read
```

因此下一步 R10.3.1 应改为：

```text
start Apps Script wake
+ 并行短轮询 authoritative ledger
→ 任一先完成

ledger 先 finalized:
  abort/停止等待 HTTP client fetch
  return 200 receiptReady=true immediately

worker 先正常返回:
  保持现有流程
```

这不改变正式业务结果来源；Fast Wake 仍不返回 receipt body，仅返回 readiness/status。

## 4. 安全边界

- command_id 幂等不变；
- ledger 仍是 authoritative delivery state；
- RECEIPT 仍是正式业务结果；
- Fast Wake token 不扩大为业务数据读取 token；
- abort Vercel→Apps Script 的等待不等于撤销服务器端已开始的 Apps Script；业务执行仍由 ledger 保证一次性。

## 5. 当前状态

R10.3 command-receipt fast path 已 Production；R10.3.1 “ledger wins the race” 优化待代码、CI 与下一次独立 Production 授权。
