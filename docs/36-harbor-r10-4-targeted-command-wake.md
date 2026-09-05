# Harbor R10.4 — Targeted Command Wake

> 状态：代码、测试、CI 已完成；2026-09-06 用户已将 `Code.gs` + `FastKick.gs` 手动同步到 Cat Apps Script 并重新部署 Web App。当前等待一次真实 Harbor Cat Fast Wake 速度验收，不提前标记为通过。

## 1. 问题

R10.3.1 Production 速度复测确认，authoritative RECEIPT 完成后的额外等待已经基本消除，但 Fast Wake 启动到 Worker 真正进入 `/api/drive-bridge/execute` 仍约有 4～5 秒。

现有 Apps Script 对显式 Fast Wake 仍执行通用批处理器 `processPendingCommands()`：

- 最长等待 Script Lock 5 秒；
- 读取整张 `COMMANDS` 并扫描所有 pending；
- 一次最多处理 25 条；
- 完成命令后在持有同一 Script Lock 的情况下刷新全部 `STATE_*` snapshot。

而 Vercel Fast Wake 已经明确携带唯一 `commandId`，因此显式 wake 没有必要走上述通用批处理路径。

## 2. R10.4 决策

显式 Fast Wake 改为 command-targeted processor：

```text
Vercel Fast Wake(commandId)
→ Apps Script doPost
→ processCommandByIdFast_(commandId)
→ 精确找到这一条 COMMAND
→ 只执行这一条
→ 写对应 RECEIPT / COMMAND status
→ 释放 Script Lock
→ best-effort refreshSnapshot
```

Drive Watch 与 1 分钟 fallback 仍继续使用原来的 `processPendingCommands()`，作为批处理与兜底路径。

## 3. Targeted lookup

`FastKick.gs` 优先扫描 COMMANDS 尾部 64 行，因为 ChatGPT 新增命令正常位于尾部；未命中时再通过 command_id 列的 `TextFinder.matchEntireCell(true)` 精确查找。

考虑 Google Sheet 刚追加后到 Apps Script 可见可能存在极短传播延迟，targeted path 最多等待 1.2 秒，每 150ms 再查一次。仍找不到时返回 `command_not_visible`，绝不伪造成功。

## 4. Lock 策略

显式 Fast Wake 的 lock wait 从通用路径的 5000ms 降为 250ms。

如果其他 Worker 正持有 Script Lock：

```text
{ ok:false, skipped:"locked", targeted:true }
```

随后由现有 R10.3 / R10.3.1 authoritative ledger 逻辑判断另一 Worker 是否已经完成，不再让第二个显式 wake 排队等待 5 秒。

## 5. Snapshot 与正式业务结果分离

R10.4 targeted path 在正式 command receipt/status 写入后立即释放 Script Lock，再 best-effort 执行 `refreshSnapshot()`。

原因：`STATE_*` 已被定义为 UI/read-model / fallback，不是正式业务结果。慢 snapshot 不应阻塞下一条显式 Fast Wake。

正式结果仍为：

```text
AI Access Core / Canonical Service
→ authoritative command ledger
→ RECEIPT
```

## 6. 不改变的安全与架构边界

- command_id 幂等规则不变；
- 只处理 `status=pending` 的目标 command；
- 已处理 command 再次 wake 只返回 no-op；
- 图片仍走现有 Drive originals → staging → media pipeline；
- Fast Wake token 权限不扩大；
- Harbor 不新增业务 schema / 权限规则；
- AI Access Core 不因本优化发生变化；
- 未来 MCP 不继承该 Apps Script transport 优化。

## 7. 自动化测试

`tests/server/harbor-fast-kick-source.test.ts` 固定以下 source contract：

- `doPost` 有 commandId 时必须进入 targeted processor；
- 无 commandId 仍保留 legacy batch fallback；
- explicit lock wait 为短等待；
- 优先 tail lookup，并有 exact TextFinder fallback；
- `/execute` 只发送目标 command；
- Script Lock 必须在 snapshot refresh 前释放；
- locked / command_not_visible 不能伪装成成功执行。

PR #72 的 CI：Test / Lint / Build 全部通过。

## 8. 部署边界与当前 live 状态

这次与 R10.3.1 不同：关键修改位于 Google Apps Script 源码。因此仅部署 Vercel不能激活 R10.4。

2026-09-06，用户已确认完成以下人工步骤：

```text
Cat Apps Script
- Code.gs 已替换为 main 最新版
- 新增 FastKick.gs
- Web App 已以新版本重新部署
```

因此 live Apps Script 代码现在应具备 R10.4 targeted processor，但仍需真实 Harbor Cat 命令命中 Fast Wake 后，用 COMMAND / RECEIPT / ledger 时间线验证，才能将状态改为“Production 验收通过”。

当前这个维护会话可读写 Harbor Sheet，但没有可安全调用带 wake-only token 的任意 HTTP GET 工具；因此不能用维护会话自己伪造 Fast Wake 验收。真实验收必须由 Harbor Cat 正常调用路径触发。

## 9. 验收指标

真实 Harbor Cat 请求后记录：

```text
COMMAND created_at
Fast Wake request（若日志可观测）
ledger received_at
receipt finished_at
COMMAND processed_at
ledgerFirst
skipped / targeted
```

验收重点：

1. 新命令不再依赖通用整表扫描；
2. 显式 wake 不再最多排队 5 秒等待 Script Lock；
3. 正式 receipt 写完后 snapshot 不再占住 Script Lock；
4. 不创建重复 command / 重复 mutation；
5. 与 R10.3.1 的约 4～5 秒 pre-worker 启动段比较是否明显缩短。

目标不是承诺固定毫秒数，而是确认显式 wake 不再因整表扫描、5 秒 lock queue 或 snapshot-under-lock 产生可避免的启动延迟。
