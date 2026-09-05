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

已通过：

- 自然查询；
- 自然新增；
- 缺字段自然追问；
- 中文 resource / action / person / meal type 等 alias；
- 数量、单位、时间、体重字符串等格式归一；
- moodKey → moodLabel 业务语义；
- 三餐、体重、药箱、活动、信箱、设置等当前 AI 能力；
- 餐食照片原图 → 压缩 → Storage → 绑定；
- 餐食删除后的 Storage 清理；
- partial update hydration：用户只说变化字段时服务端读取旧记录并 patch merge；
- cat / fish ownership；
- delete 明确意图保护；
- command 幂等。

Partial update Production 实测：新增临时药品数量 1 → update 仅提交 quantity=2 → 药名与备注等旧字段完整保留 → Supabase 核验一致 → 测试记录归档清理。

相关文档：

- `docs/26-ai-access-core-principles.md`
- `docs/27-ai-integration-decision-log.md`
- `docs/28-ai-natural-language-contract.md`
- `docs/29-ai-access-core-unified-acceptance-2026-09-05.md`
- `docs/30-ai-access-core-partial-update-hardening-2026-09-05.md`

## 3. Harbor Fast Wake 最终状态

PR #69 修复了“命令其实已完成，但 Apps Script transport 返回异常导致 Fast Wake 502”的假阴性。

当前判定规则：

```text
Apps Script 正常 ok=true
→ Fast Wake 200

Apps Script ok=false / locked / HTTP 异常
→ 查 Supabase authoritative command ledger
→ finalized + receipt 存在
→ Fast Wake 200 + reconciledFromLedger=true

ledger 仍 processing / 不存在
→ 才 retry / 返回真实 transport error
```

重要语义：

```text
Fast Wake HTTP 200 = transport 已完成
RECEIPT ok=true      = 业务成功
RECEIPT ok=false     = 业务已处理，但需追问或业务校验失败
```

不能再把“业务失败”误报成“桥没唤醒”。

## 4. Fast Wake Production 专项验收

受控 Production deployment：`dpl_9R7gRSwpvTw7Lgpu3X8Ehpja7mo9`。

专项回归 1：成功 query。

- RECEIPT：ok=TRUE；
- Apps Script 返回并发锁场景；
- Fast Wake：HTTP 200；
- `reconciledFromLedger=true`；
- `commandStatus=succeeded`；
- `skipped=locked`。

专项回归 2：故意缺少体重的 mutation。

- RECEIPT：ok=FALSE；
- 自然错误：`需要向用户确认：要记录多少公斤？`；
- Fast Wake：HTTP 200；
- `reconciledFromLedger=true`；
- `commandStatus=failed`；
- `skipped=locked`。

这证明 transport 与业务结果已经正确解耦。

专项回归后：

- 正式域名首页 HTTP 200；
- Vercel 最近 30 分钟 Runtime Errors：无；
- 本轮仅产生 1 次 Production deployment；
- `vercel.json` 已恢复 `git.deploymentEnabled=false`；
- 恢复关闭自动部署的提交未触发第二次 Production deployment。

Fast Wake 详细记录：

- `docs/31-harbor-fast-wake-ledger-reconciliation-2026-09-05.md`

## 5. 当前开发边界

现在如果新增生理期、更多药箱操作、其他生活模块或未来 MCP，应继续遵守：

```text
先定义 canonical business contract
→ 再定义 natural input normalization / clarification
→ 注册 life_query / life_mutate
→ Harbor 只做 Adapter 转发
→ MCP 未来直接复用 Core
```

不得把新的业务 schema、枚举解释、权限判断长期塞入 ChatGPT Project prompt、Google Sheet 或 Apps Script。

## 6. 当前部署规则

Production 自动部署默认关闭：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

每一次新的 Production deployment 都必须获得用户当次明确授权；授权不自动延续到下一次部署。
