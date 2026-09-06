# R10：Harbor Cat / Harbor Fish × Google Drive Bridge（历史归档）

> 状态：**已被 2026-09-06 的直接 MCP 主链路取代。**
>
> 当前 Harbor Cat / Harbor Fish 的有效 Project 数据操作规则见：
> `docs/46-harbor-mcp-project-instructions.md`。
>
> 当前架构见：`docs/02-architecture.md` 与 `docs/11-ai-write-architecture.md`。

## 1. 当前结论

R10 曾使用 Google Drive / Google Sheets 作为 ChatGPT Project 与 Couple Better Game 之间的兼容传输层：

```text
Harbor Project
→ COMMANDS
→ Apps Script / Fast Wake
→ RECEIPTS
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

这条路径已完成其过渡作用，**不再是 Harbor 的默认或推荐读写路径**。

2026-09-06 已完成并实测的新主链路：

```text
Harbor Cat
→ Harbor-Cat MCP
→ OAuth cat
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase

Harbor Fish
→ Harbor-Fish MCP
→ OAuth fish
→ /mcp
→ life_query / life_mutate
→ AI Access Core
→ Supabase
```

## 2. Bridge 当前定位

Google Drive / Sheet Bridge 现在只作为短期兼容 / 回滚能力保留。

以下对象均属于 legacy transport，不再进入正常 Harbor 工作流：

```text
COMMANDS
RECEIPTS
STATE_*
Fast Wake
Drive Watch
Apps Script Worker
Bridge pairing
```

Supabase 从始至终都是唯一正式生活数据事实源。

正常 Harbor 请求不得主动：

- 创建 COMMAND；
- 扫描或等待 RECEIPT；
- 触发 Fast Wake；
- 使用 STATE_* 代替 life_query；
- 因为用户在文字中自称 Cat/Fish 而改变 actor。

只有 MCP 明确不可用、并且用户明确要求使用兼容通道时，才考虑 Bridge。

## 3. 历史设计为什么保留

Bridge 后端代码、Apps Script、Sheet 与 Drive 资源暂不物理删除，是为了：

```text
短期回滚
历史审计
迁移参考
灾备设计参考
```

它们不是当前 Project Instructions。

旧 R10 详细实现历史仍可通过本文件的 Git 历史查看；不要把旧版本中的“R10 正式入口”“COMMAND / RECEIPT 正常路径”等描述重新复制回 Harbor Project。

## 4. 当前身份规则

```text
Harbor-Cat OAuth  → actor = cat
Harbor-Fish OAuth → actor = fish
```

身份由 OAuth token / 服务端授权上下文绑定。

AI 昵称、用户自称、普通 `person` 字段均不能切换服务端 actor。

## 5. 退役条件

Bridge 暂时保留，待 Harbor-Cat / Harbor-Fish 经过一段真实使用稳定后再物理清理。

物理退役时再单独决定是否删除：

```text
Drive / Sheet 资源
Apps Script Worker
Fast Wake / Watch 路由
Bridge env
life_drive_bridge_commands 等兼容代码或表
```

任何 Production 代码删除与部署仍必须单独获得用户当次明确授权。
