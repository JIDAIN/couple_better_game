# AI Access Core partial update 收尾记录（2026-09-05）

## 结论

统一验收发现的 partial update 边界已由 PR #68 收口；餐食照片删除问题经进一步核验属于验收判断错误，现有代码已经正确清理 Storage object。

## 1. Partial update 的最终处理原则

用户修改已有记录时，不要求模型完整复述旧记录。

标准链路：

`用户自然语言 patch`
→ `AI 先查询并定位唯一真实 ID`
→ `life-agent-executor 读取真实旧记录`
→ `自然字段 patch 映射到 canonical 字段`
→ `旧记录 + patch 合并`
→ `原有 life-input-normalizer / canonical parser 严格校验`
→ `原有 ownership / delete / business service 写入`

覆盖：activity、meal、weight、medicine、mailbox。

示例：

`把这盒布洛芬数量改成 2`

AI 只需要提供已查询到的记录 ID 和 `count: 2`；服务端自动保留药名、生产日期、有效期、备注等未修改字段。

这使 Harbor、程序内置 AI 与未来 MCP 能共享同一个业务入口，而不是各自在 prompt 中维护“修改时要复述完整 payload”的脆弱规则。

## 2. 安全边界保持不变

- update/delete 仍必须基于真实记录 ID；AI 不得编造 UUID；
- 没有唯一目标时应先查询/追问；
- meal / weight / mailbox 等原有 ownership 检查继续在 canonical registry 中执行；
- delete 不走 update hydration；
- partial update 只补齐服务端已有事实，不推断用户没有表达的新事实。

## 3. 餐食照片删除复核更正

原验收记录因为 delete RECEIPT 仍返回旧 `photoPath`，曾推断 Storage 可能遗留孤儿对象。进一步检查确认：

- `lib/server/supabase-nutrition.ts` 的 `deleteMeal()` 在 `delete_meal_record` 成功后，如果返回记录含 `photoPath`，会 best-effort 调用 `deleteMealPhotoObject(photoPath)`；
- 对本轮验收照片的实际 Storage path 查询 `storage.objects`，结果为空。

因此照片清理实际已成功。RECEIPT 中保留旧 `photoPath` 只是“被删除记录的快照字段”，不是对象仍存在的证据。

后续排查 Storage cleanup 时必须直接核验 Storage object，而不能仅依据业务删除返回值判断。

## 4. 验证

PR #68 自动化 CI：

- Test ✅
- Lint ✅
- Build ✅

新增回归测试覆盖：

- 药品只修改数量时保留旧字段；
- 餐食只修改备注时保留原 items；
- delete 不触发 partial update hydration。

## 5. 当前部署状态

代码已合并 `main`，但 `vercel.json` 仍为 `git.deploymentEnabled: false`。

因此本次收尾代码尚未进入 Production。下一次 Production 部署仍需用户明确授权，部署后再做最小真实回归即可将 AI Access Core 第一阶段标记为“统一验收完全通过”。
