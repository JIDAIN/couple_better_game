# AI 接入当前状态总览（更新至 2026-09-06）

> 用途：作为当前 AI 接入开发的“现在事实”入口。历史问题与过程记录保留在专项文档中；发生冲突时，以本页和更晚的专项验收记录为准。

## 1. 当前架构基线

```text
AI Entry / Adapter
  当前 Production：ChatGPT Project → Harbor Sheet / Apps Script / Drive Watch
  已完成代码准备：MCP Adapter → AI Access Core
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

## 3. Harbor Fast Wake 基线

PR #69 已解决“命令已完成但 transport 返回 502”的假阴性。

R10.3 将 Harbor 理想 fast path 定义为：

```text
直接 life_query / life_mutate
→ COMMANDS 只追加 1 行
→ Fast Wake 只调用 1 次
→ 精确读取同 command_id RECEIPT
→ 回复
```

`STATE_*` 只作为 UI/read-model 与故障 fallback。

## 4. Harbor R10.3.1 Ledger-first（Production 已验收）

R10.3 Production 速度测试发现：authoritative RECEIPT 已 finalized 后，Vercel 仍可能继续等待 Apps Script snapshot / 后处理，导致 Fast Wake 从约 5～6 秒可用事实拖到约 16 秒才 HTTP 返回。

R10.3.1 改为 Fast Wake HTTP 与 authoritative ledger polling 并行；ledger 先 finalized 时立即返回。

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

结果：backend business execution ≈1.27s；Fast Wake start → receipt ≈5.92s；receipt 后额外等待约 0.1s。

详细记录：`docs/35-harbor-r10-3-1-ledger-first-race.md`。

## 5. Harbor R10.4 Targeted Command Wake（Apps Script live 已更新，但 ChatGPT Project 未命中）

R10.4 在 Apps Script 增加 targeted processor：显式 Fast Wake 携带 `commandId` 时，只定位并执行目标 COMMAND，短 lock wait，receipt/status 后先释放 lock，再 best-effort snapshot。

用户已于 2026-09-06 人工同步并重新部署 Cat Apps Script Web App。

但随后两次 Harbor Cat 正常业务请求均没有真正调用 Fast Wake，而是落入 Drive Watch / 约 1 分钟 fallback：

```text
样本 1：COMMAND → Worker ≈ 59.6s，业务执行 ≈ 1.2s
样本 2：COMMAND → Worker ≈ 69.5s，业务执行 ≈ 1.41s
```

这确认了当前主要问题不是 AI Access Core，也不是 R10.4 targeted processor 本身，而是 ChatGPT Project 当前工具集合里没有一个可直接调用 `/api/drive-bridge/kick` 的一等 Fast Wake 工具。Project Instructions 只能约束模型行为，不能凭空增加 HTTP 工具。

因此不再继续通过 prompt 调优来解决这类 transport 延迟。

详细记录：

- `docs/36-harbor-r10-4-targeted-command-wake.md`
- `docs/37-harbor-r10-4-first-live-sample-2026-09-06.md`

## 6. Bridge Sheet 当前提示

Harbor Cat Sheet README / META 已加入 fast-path 运行提示：

- `ai_interaction_mode=command_receipt_fastpath`
- `capabilities_probe=disabled_for_normal_requests`
- `state_read_policy=fallback_only`
- `wake_retry_policy=single_wake_then_receipt`

这些只是 Adapter 运行提示，不是业务 contract。

## 7. 当前体感延迟结论

目前已经明确分层：

- canonical backend query/mutate 常约 1～1.5 秒；
- RECEIPT 后 Fast Wake 尾部等待已由 R10.3.1 基本消除；
- 当前 Harbor Cat 正常使用的主要慢点是 Google Drive Watch / fallback 唤醒，而不是正式业务执行；
- 仅继续修改 Project Instructions 不能补出一个不存在的 Fast Wake 调用工具。

因此长期性能方向从“继续打磨 Harbor transport”切换为“让支持 MCP 的客户端直接进入 AI Access Core”。

## 8. R11 MCP → AI Access Core（代码已合并 main，未部署 Production）

PR #73 已将旧 R8 MCP 独立业务实现替换为 AI Access Core Adapter。

合并 commit：

```text
96cee880a523e5186fc924ffc6b56a7cb376bfde
```

MCP 公开 contract 统一为：

```text
life_capabilities
life_query
life_mutate
```

旧 `life_write` 不再作为新 MCP 主 contract。

MCP Adapter 当前只负责：

- OAuth scope；
- Cat/Fish 固定身份；
- MCP schema；
- file reference → 既有 media boundary；
- JSON-RPC id → Core toolCallId；
- `userText` → Core delete/high-risk safety；
- Core clarification → MCP ToolResult。

真正业务逻辑统一复用：

```text
life-agent-executor
→ life-agent-registry
→ canonical services
```

CI run #395：Test ✅ / Lint ✅ / Build ✅。

详细记录：`docs/38-r11-mcp-core-adapter.md`。

当前只是代码 ready；由于本轮没有新的 Production deployment 授权，Production `/mcp` 仍然运行旧版本，尚未做 R11 live smoke test。

## 9. MCP 替换边界

MCP 不继承：Sheet COMMANDS/RECEIPTS、Apps Script、Fast Wake、STATE_* AI 读取策略。

MCP 继续复用：AI Access Core、natural input normalization、clarification、canonical services、权限、幂等、业务语义和媒体规则。

Harbor 当前继续作为 Plus 环境下的兼容入口；未来支持完整 MCP 的客户端可直接使用 `/mcp`。

## 10. 当前部署规则

Production 自动部署默认关闭：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

每一次新的 Production deployment 都必须获得用户当次明确授权；授权不自动延续到下一次部署。
