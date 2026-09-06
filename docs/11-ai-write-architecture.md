# AI 访问与写入架构

状态：2026-09-06 / R11.5。

详细饮食草稿、营养和照片规则见 `docs/45-r11-5-meal-nutrition-photo-display.md`。

## 1. 总目标

AI 必须能够像当前授权身份用户一样读取和修改 Couple Better Game，但不能获得任意 SQL / 任意表写权限。

稳定业务能力中心：

```text
life_capabilities
life_query
life_mutate
```

所有 AI 入口最终进入同一个 server-side registry，再调用 canonical domain service / RPC / Supabase Storage。

## 2. 当前 AI 入口

### Harbor Cat / ChatGPT Project（正式主入口）

```text
Harbor Cat / 团子
→ Harbor-Cat MCP
→ OAuth = cat
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

固定语义：

```text
Harbor Cat authoritative actor = cat
我 = cat
Ta / 对象 = fish
```

“团子”只是 AI 昵称，不是身份凭证。

### Harbor Fish / ChatGPT Project（正式主入口）

```text
Harbor Fish
→ Harbor-Fish MCP
→ OAuth = fish
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

固定语义：

```text
Harbor Fish authoritative actor = fish
我 = fish
Ta / 对象 = cat
```

Cat / Fish 身份由 OAuth token 与服务端授权上下文绑定，不能由聊天文本切换。

### 其他 MCP client

```text
MCP client
→ OAuth / fixed access identity
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

### 程序内置 AI

```text
已登录 cat/fish
→ /ai
→ /api/ai/chat
→ Vercel AI Gateway
→ life-agent-registry
→ AI Access Core
```

### Google Drive / Sheet Bridge（兼容回滚）

```text
legacy Harbor transport
→ Google Drive / Bridge COMMAND
→ Fast Wake / Worker
→ /api/drive-bridge/*
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

Bridge 不再是 Harbor 正常读写路径，仅作为短期兼容 / 回滚入口保留。

以上入口共享同一套业务权限、校验和数据事实源，不复制 CRUD。

## 3. Tool Registry

主要查询资源：

```text
day
month
meal
weight
medicine
mailbox
settings
life_export
legacy_home
```

主要修改资源：

```text
mood       upsert
sleep      upsert
activity   create / update / delete
meal       create / update / delete + photo
weight     create / update / delete
medicine   create / update / delete
mailbox    create / update / delete
settings   update
legacy_home replace
```

未来新增 `cycle` 等模块时，只需新增 canonical domain service 并注册 query/mutate，不重新设计 Harbor/MCP 协议。

## 4. 身份和权限

身份由服务端授权上下文决定，不从模型猜测。

Harbor Cat 使用 Harbor-Cat OAuth 身份；Harbor Fish 使用 Harbor-Fish OAuth 身份；程序内置 AI 使用当前登录身份。Bridge 兼容通道继续使用 HMAC 固定身份。

核心权限：

- Mood / Sleep / Meal / Weight：个人写入只允许当前 actor；
- Meal / Weight update/delete：按记录 owner 再次核验；
- Mailbox：sender 固定当前 actor，recipient 按业务规则指向 Ta；
- Medicine / Activity：按当前共享规则；
- Settings：共享项与个人项分别执行权限；
- delete：必须来自当前用户明确删除意图；
- `legacy_home.replace`：仍需明确高风险确认；
- 禁止 `run_sql`、`write_any_table`、`raw_supabase_request` 等任意数据层能力。

## 5. 正式写入与幂等

AI 对事实的理解和数据库写权限是两回事。

标准正式写入：

```text
自然语言
→ AI 提取业务语义
→ life_mutate
→ domain validation / permission
→ idempotency
→ canonical service / RPC
→ read-back / receipt
```

MCP 和各 domain 使用稳定幂等种子/写入键；Bridge 兼容路径继续使用 `(actor, command_id)` ledger。

如果执行结果不确定，应读回相同 operation/record，而不是换新 id 盲目重放。

## 6. 饮食草稿确认：对话层软约束

新的 meal 使用：

```text
分析
→ 待确认草稿
→ 用户修改 / 确认
→ 正式 life_mutate
```

重要：这不是后台状态机。

当前明确取消：

- server-side `meal_drafts`；
- 持久化 draft token/state；
- 通过当前一句 `userText` 是否包含“确认/可以/好的”来硬拦截 meal create。

草稿状态由 AI 的聊天上下文承接。

因此用户已经确认后，如果正式写入临时失败，再说“再试一次”，AI 可以继续重试已确认的正式操作；AI Access Core 不会因为“再试一次”不包含确认关键词而拒绝。

代价是：这是一层 agent 行为约束，不是 cryptographic/server-side proof。身份、删除、高风险覆盖等真正安全边界仍必须保留在服务端。

## 7. 饮食实际摄入与完整营养

新 meal 的默认目标是记录实际摄入，而不是餐前摆盘。

判断优先级：

```text
用户明确文字
>
餐前/餐后视觉差分
>
单图合理估算
```

确认写入时，在能合理判断的前提下尽量一次提交：

```text
rawName / displayName
portionDescription
estimatedWeightG
caloriesKcal
proteinG
carbsG
fatG
totalCaloriesKcal
```

真正未知字段允许 `null`；不能为了“字段完整”编造不存在的精确值。

MCP `life_mutate` description 和内置 AI system prompt 都包含这套默认营养完整化规则。

## 8. 餐前 / 餐后多图与单图持久化

AI 可以同时利用餐前图、餐后图做实际摄入差分，但当前 meal data model 正式只绑定 1 张展示图。

默认约定：

```text
多图都参与分析
→ 用户未指定时正式保存餐前图
→ 餐后图默认只用于估算
```

用户明确指定保存餐后图时覆盖默认。

当前不能声称两张都永久保存成功，也不能发明 `beforePhotoPath` / `afterPhotoPath`。

## 9. 图片压缩、恢复与显示

正式图片链路：

```text
原图
→ EXIF rotate
→ longest edge 600px
→ WebP q70 / q65 / q60 / q55
→ Supabase Storage
→ meals.photo_path
```

R11.5 新增显示元数据：

```text
photo_rotation_degrees = 0 / 90 / 180 / 270
photo_scale            = 0.60 .. 1.00
```

竖图上传后默认 `90°` 横向显示；用户之后可以在 UI 无损调整方向和大小。

ChatGPT Custom MCP 当前可直接接收 OpenAI 临时文件 URL。若某个 MCP 客户端没有透传图片字节：

```text
life_mutate attachPhoto=true
→ MEDIA_ATTACHMENT_REQUIRED
→ recovery.uploadUrl
→ browser upload
→ 继续同一次正式业务写入
```

收到恢复链接后不重复 create/update。

## 10. Harbor MCP 正常路径

普通 Harbor 业务：

```text
Harbor-Cat / Harbor-Fish
→ life_query / life_mutate
→ /mcp
→ AI Access Core
→ Supabase
```

普通已知 query/mutate 不先 `life_capabilities`。

正常 Harbor 请求不创建 `COMMAND`、不扫描 `RECEIPTS`、不触发 `Fast Wake`、不读取 `STATE_*` 作为事实源。

## 11. Drive Bridge 与 Supabase 边界

Google Sheets / Drive Bridge 已降级为兼容 / 回滚传输层，不是事实源，也不是 Harbor 默认入口。

```text
COMMANDS   旧命令日志
RECEIPTS   旧执行结果
STATE_*    只读镜像 / fallback
META       Bridge 元数据
```

Supabase 始终是正式生活数据 Source of Truth。

只有 MCP 明确不可用且用户要求走兼容通道时，才考虑 Bridge。

## 12. Harbor Project 指令

当前有效模板见：

`docs/46-harbor-mcp-project-instructions.md`

原则：

```text
Harbor Cat  → 只使用 Harbor-Cat → OAuth cat
Harbor Fish → 只使用 Harbor-Fish → OAuth fish
```

旧 Google Bridge Project Instructions 不再作为正常工作流。

## 13. 新 Domain 接入规范

新增例如 `cycle`：

1. 建表 / 约束 / migration；
2. 建 canonical server service / RPC；
3. 明确 owner / shared 权限；
4. 注册 `life_query / life_mutate`；
5. 必要时扩展 `life_capabilities`；
6. 增加权限、幂等、读回测试；
7. 需要备份时扩展 `life_export`；
8. Harbor/MCP 协议保持稳定。

## 14. Production 部署纪律

Production Git 自动部署默认关闭：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

任何新的 Production deployment 必须逐次获得用户明确授权。一次授权只对应当前一次受控部署，完成后立即恢复关闭。
