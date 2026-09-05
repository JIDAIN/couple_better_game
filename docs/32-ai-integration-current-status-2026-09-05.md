# AI 接入当前状态总览（2026-09-05）

> 用途：作为当前 AI 接入开发的“现在事实”入口。历史问题与过程记录保留在 26～31 文档中；发生冲突时，以本页和更晚的专项验收记录为准。

## 1. 当前架构基线

```text
AI Entry / Adapter
  当前：ChatGPT Project → Harbor Sheet / Apps Script / Fast Wake
  未来：MCP / 其他 AI API
        ↓
AI Access Core
        ↓
Canonical Life Services
        ↓
Supabase Database / Storage
```

长期原则：Harbor 是可替换 Adapter，业务语义、自然输入归一化、权限、幂等、删除安全、媒体规则不能写死在 Harbor 中。

## 2. AI Access Core 第一阶段状态

AI Access Core 第一阶段已经完成统一 Production 验收。

已通过：自然查询、新增、缺字段追问、中文 aliases、日期/单位/时间归一、moodLabel、三餐/体重/药箱/活动/信箱/设置、照片链路、partial update hydration、ownership、delete safety、command 幂等。

Partial update Production 实测：新增临时药品数量 1 → update 仅提交 quantity=2 → 药名与备注等旧字段完整保留 → Supabase 核验一致 → 测试记录归档清理。

相关文档：

- `docs/26-ai-access-core-principles.md`
- `docs/27-ai-integration-decision-log.md`
- `docs/28-ai-natural-language-contract.md`
- `docs/29-ai-access-core-unified-acceptance-2026-09-05.md`
- `docs/30-ai-access-core-partial-update-hardening-2026-09-05.md`

## 3. Harbor Fast Wake 当前状态

PR #69 已解决“命令已完成但 transport 返回 502”的假阴性。

Production 专项验收：`dpl_9R7gRSwpvTw7Lgpu3X8Ehpja7mo9`。

已验证：Apps Script `locked` 时，authoritative ledger 可正确把 `succeeded` 和业务 `failed` 都识别为 transport 已完成，Fast Wake 返回 200，业务结果继续由 RECEIPT 表达。

## 4. Harbor R10.3 交互 Fast Path（当前开发中）

进一步分析发现，剩余体感延迟主要不在 AI Access Core：backend 真正 query/mutate 常约 1 秒，较长等待来自 ChatGPT Project 自己进行不必要的工具编排，例如 capabilities 探测、STATE_* 读取、网页/GitHub 搜索、重复 Fast Wake、扫描历史 COMMANDS/RECEIPTS。

因此当前目标改为让 Harbor 的调用形态尽量接近未来 MCP：

```text
用户自然语言
→ 直接 life_query / life_mutate
→ COMMANDS 只追加 1 行
→ Fast Wake 只调用 1 次
→ 精确读取同 command_id RECEIPT
→ 回复
```

默认禁止：

- 普通请求例行 `life_capabilities`；
- 正常查询先读 STATE_*；
- 为业务字段搜索网页/GitHub/仓库文档；
- 重复 wake；
- 创建多个试探 payload；
- 扫描整张 RECEIPTS 或历史 COMMANDS。

`STATE_*` 已重新定义为 UI/read-model 与故障 fallback，不是正常 Harbor query 的入口。

### Lock contention 优化

Fast Wake route 正在增加锁竞争优化：

```text
Apps Script skipped=locked
→ 不再立刻发第二次 wake
→ Vercel 短轮询 authoritative ledger
→ finalized：返回 receiptReady=true
→ 暂未 finalized：返回 accepted + commandStatus=processing + receiptReady=false
→ Project 只读取同 command_id RECEIPT，不再 wake
```

目的：避免多个 trigger/wake 围绕同一个 Apps Script script lock 排队，降低最坏时延和无效请求。

## 5. Bridge Sheet 当前提示

Harbor Cat Sheet README / META 已加入 fast-path 运行提示：

- `ai_interaction_mode=command_receipt_fastpath`
- `capabilities_probe=disabled_for_normal_requests`
- `state_read_policy=fallback_only`
- `wake_retry_policy=single_wake_then_receipt`

这些是 Adapter 运行提示，不是业务 contract，也不写入 secret。

## 6. 未来 MCP 替换边界

MCP 不继承：Sheet COMMANDS/RECEIPTS、Apps Script、Fast Wake、STATE_* AI 读取策略。

MCP 继续复用：AI Access Core、natural input normalization、clarification、canonical services、权限、幂等、业务语义和媒体规则。

因此 R10.3 的交互目标是“让 Harbor 看起来像一个慢一点的 MCP Adapter”，而不是继续往 Harbor 内添加业务逻辑。

## 7. 当前部署规则

Production 自动部署默认关闭：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

每一次新的 Production deployment 都必须获得用户当次明确授权；授权不自动延续到下一次部署。
