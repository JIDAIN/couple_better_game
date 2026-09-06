# AI 访问与写入架构

状态：2026-09-06 / R11.5。

## 1. 目标

AI 可以像当前授权身份用户一样读取和修改 Couple Better Game，但不能获得任意 SQL / 任意表写权限。

稳定业务能力中心：

```text
life_capabilities
life_query
life_mutate
```

所有 AI 入口最终进入同一个 server-side registry，再调用 canonical domain service / RPC / Supabase Storage。

## 2. 当前 AI 入口

### Harbor Cat

```text
Harbor Cat / 团子
→ Harbor-Cat MCP
→ OAuth = cat
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

### Harbor Fish

```text
Harbor Fish
→ Harbor-Fish MCP
→ OAuth = fish
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

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

这些入口共享同一套业务权限、校验和数据事实源，不复制 CRUD。

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

未来新增 `cycle` 等模块时，只需新增 canonical domain service 并注册 query/mutate。

## 4. 身份和权限

身份由服务端授权上下文决定，不从模型猜测。

- Harbor Cat 使用 Harbor-Cat OAuth 身份；
- Harbor Fish 使用 Harbor-Fish OAuth 身份；
- 程序内置 AI 使用当前登录身份。

核心权限：

- Mood / Sleep / Meal / Weight：个人写入只允许当前 actor；
- Meal / Weight update/delete：按记录 owner 再核验；
- Mailbox：sender 固定当前 actor，recipient 按业务规则指向 Ta；
- Medicine / Activity：按共享规则；
- Settings：共享项与个人项分别执行权限；
- delete：必须来自当前用户明确删除意图；
- `legacy_home.replace`：仍需明确高风险确认；
- 禁止 `run_sql`、`write_any_table`、`raw_supabase_request` 等任意数据层能力。

## 5. 正式写入与幂等

```text
自然语言
→ AI 提取业务语义
→ life_mutate
→ domain validation / permission
→ idempotency
→ canonical service / RPC
→ read-back / tool result
```

MCP 和各 domain 使用稳定幂等种子/写入键。执行结果不确定时应读回相同 operation/record，而不是换新 id 盲目重放。

## 6. 饮食草稿确认

新的 meal 使用：

```text
分析
→ 待确认草稿
→ 用户修改 / 确认
→ 正式 life_mutate
```

草稿状态属于聊天上下文，不建立 server-side `meal_drafts`，也不通过当前一句 `userText` 是否含“确认”来硬拦截 create。

身份、删除、高风险覆盖等真正安全边界继续由服务端保证。

## 7. 实际摄入与完整营养

默认优先级：

```text
用户明确文字
>
餐前/餐后视觉差分
>
单图合理估算
```

确认写入时，在能合理判断的前提下尽量一次提交重量、热量、蛋白质、碳水和脂肪；真正未知字段允许 `null`，不制造虚假精度。

## 8. 图片

正式图片链路：

```text
原图
→ EXIF rotate
→ longest edge 600px
→ WebP q70 / q65 / q60 / q55
→ Supabase Storage
→ meals.photo_path
```

当前 meal 正式只绑定一张展示图。多图可以用于分析，但不会虚构多图持久化字段。

ChatGPT Custom MCP 可直接接收 OpenAI 临时文件 URL。若某个 MCP client 不透传图片字节，则使用 `MEDIA_ATTACHMENT_REQUIRED → recovery.uploadUrl` 恢复同一次正式业务写入。

## 9. Harbor Project 指令

当前有效模板：

`docs/46-harbor-mcp-project-instructions.md`

```text
Harbor Cat  → Harbor-Cat → OAuth cat
Harbor Fish → Harbor-Fish → OAuth fish
```

## 10. 新 Domain 接入规范

新增例如 `cycle`：

1. 建表 / 约束 / migration；
2. 建 canonical server service / RPC；
3. 明确 owner / shared 权限；
4. 注册 `life_query / life_mutate`；
5. 必要时扩展 `life_capabilities`；
6. 增加权限、幂等、读回测试；
7. 需要备份时扩展 `life_export`。

## 11. Production 部署纪律

Production Git 自动部署默认关闭。任何新的 Production deployment 必须逐次获得用户明确授权；一次授权只对应当前一次受控部署，完成后立即恢复关闭。
