# AI 接入当前状态总览（2026-09-05）

> 用途：作为当前 AI 接入开发的“现在事实”入口。历史问题与过程记录保留在 26～35 文档中；发生冲突时，以本页和更晚的专项验收记录为准。

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

R10.3 已把 Harbor 正常调用固定为：

```text
直接 life_query / life_mutate
→ COMMANDS 只追加 1 行
→ Fast Wake 只调用 1 次
→ 精确读取同 command_id RECEIPT
→ 回复
```

默认禁止普通请求例行 `life_capabilities`、正常查询先读 STATE_*、网页/GitHub/仓库文档搜索、重复 wake、多个试探 payload、扫描整张 RECEIPTS / 历史 COMMANDS。

`STATE_*` 只作为 UI/read-model 与故障 fallback。

## 4. Harbor R10.3.1 Ledger-first（Production 已验收）

R10.3 Production 速度测试发现：authoritative RECEIPT 已 finalized 后，Vercel 仍可能继续等待 Apps Script snapshot / 后处理，导致 Fast Wake 从约 5～6 秒可用事实拖到约 16 秒才 HTTP 返回。

R10.3.1 改为：

```text
Fast Wake
├─ Apps Script HTTP wake
└─ authoritative ledger polling

ledger 先 finalized + receipt
→ 立即 Fast Wake 200
→ ledgerFirst=true
→ receiptReady=true
→ 停止等待当前 Apps Script HTTP client
```

Production deployment：

```text
dpl_E7LxGVH2KjASMwXzsEPoZo62Qd4i
```

真实第二次速度复测：

```text
Fast Wake server start ≈ 15:34:31.966Z
ledger received_at      = 15:34:36.615Z
receipt finished_at     = 15:34:37.882Z
Fast Wake HTTP response ≈ 15:34:38Z
```

结果：

```text
backend business execution   ≈ 1.27 s
Fast Wake start → receipt    ≈ 5.92 s
receipt 后额外等待           ≈ 0.1 s 量级
Fast Wake 总服务端等待       ≈ 6 s
ledgerFirst                  true
receiptReady                 true
```

与 R10.3 约 16 秒的 Fast Wake HTTP 等待相比，R10.3.1 已基本消除 RECEIPT 完成后的 transport 尾部等待。

详细记录：`docs/35-harbor-r10-3-1-ledger-first-race.md`。

## 5. Bridge Sheet 当前提示

Harbor Cat Sheet README / META 已加入 fast-path 运行提示：

- `ai_interaction_mode=command_receipt_fastpath`
- `capabilities_probe=disabled_for_normal_requests`
- `state_read_policy=fallback_only`
- `wake_retry_policy=single_wake_then_receipt`

这些是 Adapter 运行提示，不是业务 contract，也不写入 secret。

## 6. 当前剩余体感延迟来源

现在主要延迟已不在 canonical business service，也不在 Apps Script 完整后处理等待：

- backend query/mutate 常约 1～1.5 秒；
- Fast Wake 可在 authoritative receipt finalized 后立即结束；
- 剩余主要来自 COMMAND 写入、Apps Script/Drive worker 启动、Google/ChatGPT 工具调用往返，以及 ChatGPT Project 是否严格遵守单 COMMAND / 单 Wake / 精确 RECEIPT fast path。

因此后续性能优化应优先围绕 Adapter 启动与工具编排，而不是往 AI Access Core 添加特殊逻辑。

## 7. 未来 MCP 替换边界

MCP 不继承：Sheet COMMANDS/RECEIPTS、Apps Script、Fast Wake、STATE_* AI 读取策略。

MCP 继续复用：AI Access Core、natural input normalization、clarification、canonical services、权限、幂等、业务语义和媒体规则。

Harbor 的目标始终是“一个可替换、逐步逼近 MCP 体验的临时 Adapter”。

## 8. 当前部署规则

Production 自动部署默认关闭：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

每一次新的 Production deployment 都必须获得用户当次明确授权；授权不自动延续到下一次部署。
