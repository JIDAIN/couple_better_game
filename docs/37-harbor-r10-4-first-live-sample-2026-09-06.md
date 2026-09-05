# Harbor R10.4 — First Live Sample (2026-09-06)

## 结论

本次从 Harbor Cat Project 发出的正常只读请求并未命中 R10.4 targeted Fast Wake，而是落入 1 分钟 fallback。

因此该样本不能用于评价 R10.4 targeted processor 的速度；它验证的是：当 Project 没有调用 Fast Wake 时，fallback 仍然能最终处理命令。

## 样本

用户请求：

```text
团子，查询我今天的生活记录，只读取，不修改任何数据。
```

command_id：

```text
a505628b-6ad6-45f9-ad6d-e8c3c2d6f527
```

时间线：

```text
COMMAND created_at = 2026-09-06T00:38:30+08:00
ledger received_at = 2026-09-05T16:39:29.611Z
receipt finished_at = 2026-09-05T16:39:30.811Z
```

换算：

```text
COMMAND -> Worker received ≈ 59.6 s
backend business execution ≈ 1.2 s
```

## 根因分类

该问题属于 Harbor Cat Project / AI orchestration 层，而不是 Apps Script targeted processor、AI Access Core 或 canonical business service。

现场表现说明：

- Project 成功追加了 1 条 COMMAND；
- 但没有在追加后立即调用 Fast Wake；
- Apps Script 的 1 分钟 fallback 最终接管并成功执行；
- RECEIPT 正常生成，业务查询成功。

因此下一步不是继续改 R10.4 Apps Script，而是同步 Harbor Cat Project Instructions，使正常业务请求固定遵循：

```text
append exactly one COMMAND
→ call Fast Wake exactly once with same commandId
→ read only matching RECEIPT
→ reply
```

## 验收状态

- R10.4 Apps Script live source：已人工同步并重新部署。
- R10.4 source contract / CI：已通过。
- R10.4 targeted Fast Wake Production speed acceptance：仍待真正命中 targeted path 的样本。
- 1 分钟 fallback：本次真实样本确认仍工作正常。

在拿到真实 targeted-path 样本前，不应把 R10.4 标记为 Production 速度验收通过。
