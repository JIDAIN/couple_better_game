# Harbor Fast Wake 假阴性修复记录（2026-09-05）

## 问题

Production 最终回归中出现一次：业务命令已成功写入 RECEIPT / Supabase，但 `/api/drive-bridge/kick` 因 Apps Script 返回 `ok=false` 最终给调用方 502 `worker wake failed`。

这属于 Harbor transport 假阴性，不是业务失败。

## 根因层级

- 层级：Harbor Adapter / transport。
- 非 AI Access Core 业务 contract 问题。
- 非 Supabase 正式数据写入问题。

Apps Script 的返回值还包含 STATE_* 镜像刷新等非权威步骤；这些步骤失败时，command 本身可能已经由 Vercel worker 完成并在 `life_drive_bridge_commands` ledger 写入最终 receipt。

## 修复原则

Fast Wake 不再把 Apps Script 的 `ok` 当作唯一成功依据。

顺序改为：

1. 唤醒 Apps Script；
2. 若 worker 正常 `ok=true`，直接成功；
3. 若 worker `ok=false` / HTTP 异常，则读取 Supabase authoritative command ledger；
4. 若同一 `actor + command_id` 已为 `succeeded` 或 `failed`，且 receipt 已存在，则说明命令已经完成投递和处理，Fast Wake 返回 HTTP 200；
5. 返回中标记 `reconciledFromLedger=true` 与 `commandStatus`；
6. 只有 ledger 仍为 processing / 不存在时，才继续安全 retry；
7. retry 后仍未 finalized 才返回真实 transport error。

## 为什么 commandStatus=failed 也可返回 Fast Wake 200

Fast Wake 的职责是“把命令送到 worker 并推动处理”，不是伪装业务结果。

如果 ledger 已经写入 `failed + receipt`，说明 transport 已完成，业务失败原因应由 RECEIPT 告诉 AI / 用户。此时再返回 Fast Wake 502 会把“业务校验失败”误报成“桥没唤醒”。

## 安全边界

- 不重新执行已 finalized 的业务 mutation；
- command_id + authoritative ledger 继续提供幂等保护；
- processing / 无 receipt 绝不被当作成功；
- ledger 查询本身失败时，不掩盖原 transport failure，继续沿用保守失败逻辑；
- Harbor 仍只是 Adapter，未来 MCP 不需要继承 Fast Wake。

## 自动化验证

新增 finalized ledger 语义测试：

- `succeeded + receipt` → finalized；
- `failed + receipt` → finalized；
- `processing` → 非 finalized；
- finalized status 但 receipt 为空 → 非 finalized；
- ledger 不存在 → 非 finalized。

PR #69 CI：Test / Lint / Build 全部通过。

## 部署状态

PR #69 已合并 `main`。`vercel.json` 仍为 `git.deploymentEnabled=false`，因此尚未部署 Production。上线仍需单独授权。
