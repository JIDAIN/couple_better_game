# Harbor R10.3 Command–Receipt Fast Path

## 1. 目标

Harbor 当前最大的剩余延迟，不是 Supabase / AI Access Core 业务执行，而是 ChatGPT Project 的工具编排绕路。

目标：把正常生活请求固定为最短链：

```text
用户自然语言
→ life_query / life_mutate
→ COMMANDS 1 行
→ Fast Wake 1 次
→ 当前 command_id RECEIPT
→ 回复
```

这是 Harbor Adapter 的性能策略；未来 MCP 会直接调用 Core，不继承 Sheet / Apps Script / Fast Wake。

## 2. 正常请求禁止绕路

正常 Harbor 业务请求不得：

- 例行调用 life_capabilities；
- 先读 STATE_*；
- 搜索网页、GitHub、仓库文档；
- 为找 schema 读取历史 COMMANDS；
- 试探多个 payload；
- 重复 Fast Wake；
- 扫描整张 RECEIPTS。

AI Access Core 已负责常见字段别名、默认日期、单位、业务枚举和 clarification。

## 3. Query

```text
用户问程序事实
→ 直接 life_query
→ append COMMANDS
→ Fast Wake once
→ exact command_id RECEIPT
→ 用 RECEIPT 回复
```

STATE_* 不参与正常 query。

## 4. Mutation

```text
用户明确新增/修改/删除
→ 直接 life_mutate
→ 只传用户实际提供的事实
→ append COMMANDS once
→ Fast Wake once
→ exact RECEIPT
```

如果 RECEIPT 返回 LIFE_CLARIFICATION_REQUIRED：只问 clarification.question。

update/delete 缺 ID：先进行一次最小 life_query 定位；多个候选则问用户；禁止猜 UUID。

## 5. Fast Wake lock contention

Apps Script 可能因为 Drive Watch、分钟 trigger 和 Fast Wake 同时触发而出现 script lock。

旧逻辑可能：

```text
wake A → locked
→ wake B
→ 再等待同一个 lock
```

R10.3 route 改为：

```text
wake → skipped=locked
→ 不发第二次 wake
→ Vercel 短轮询 Supabase authoritative ledger
```

若 ledger 已 finalized：

```json
{
  "ok": true,
  "commandStatus": "succeeded | failed",
  "receiptReady": true,
  "reconciledFromLedger": true
}
```

若短窗口内仍 processing：

```json
{
  "ok": true,
  "accepted": true,
  "commandStatus": "processing",
  "receiptReady": false,
  "skipped": "locked",
  "retryAfterMs": 1000
}
```

这时 Project 不再次 wake，只读取当前 command_id 的 RECEIPT；如暂时没有，只短暂重读 RECEIPT。

## 6. 安全边界

Fast Wake token 继续只用于 transport wake，不通过 wake endpoint 返回业务 receipt 内容。

业务数据仍只能从当前 Bridge 的 RECEIPT / canonical query result 获取；不能为减少一次 Sheet read 而把业务结果暴露给 wake token。

## 7. Harbor Cat Sheet 运行提示

Cat Bridge META：

```text
ai_interaction_mode = command_receipt_fastpath
capabilities_probe = disabled_for_normal_requests
state_read_policy = fallback_only
wake_retry_policy = single_wake_then_receipt
```

README 同步维护 fast-path、locked、clarification、STATE_* fallback 规则。

## 8. ChatGPT Project Instructions 必须具备的核心段

由于 ChatGPT Project Instructions 属于 ChatGPT 产品配置，不在 GitHub/Vercel/Supabase 可写范围内，程序无法通过仓库提交直接修改它。

最终 Project Instructions 至少必须明确：

```text
普通 Couple Better Game 请求禁止网页搜索、GitHub 搜索、仓库文档搜索和 life_capabilities 探测。
涉及已有事实：直接提交 1 个 life_query COMMAND；写操作：直接提交 1 个 life_mutate COMMAND。
每个用户动作只允许创建 1 个新的 command_id。
写入 COMMANDS 后只 Fast Wake 1 次；随后只读取该 command_id 的 RECEIPT。
Fast Wake receiptReady=false / commandStatus=processing 时不要再次 wake，只读取/短暂重读同 command_id RECEIPT。
STATE_* 仅用于故障 fallback，不是正常查询入口。
收到 LIFE_CLARIFICATION_REQUIRED 时直接询问 clarification.question，不解释后台字段。
```

完整规则以 `docs/26-harbor-project-skill-playbook.md` 为准。

## 9. 验收指标

R10.3 Production 验收时至少记录：

- 从 COMMANDS created_at 到 RECEIPT finished_at 的 backend 时间；
- Fast Wake HTTP 时间；
- Project 是否调用 life_capabilities；
- Fast Wake 次数；
- RECEIPT 读取次数；
- 是否访问 STATE_*；
- 是否出现网页/GitHub/文档搜索；
- 用户可见总耗时。

业务 backend 目标继续维持秒级；Project 工具路径目标是稳定收敛到 COMMANDS → Fast Wake → RECEIPT 三步。
