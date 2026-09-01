# 部署与安全

## 1. 当前生产架构

```text
GitHub repository
    │ code push
    ▼
Vercel
├─ Next.js frontend
├─ API Routes
└─ server environment variables
    │
    ▼
Supabase PostgreSQL
```

生产站点当前由 Vercel 托管；Supabase 是云端主数据源。

ChatGPT P2 额外存在一条**非浏览器**路径：

```text
ChatGPT
-> 用户已授权的 Supabase 连接能力
-> service-only ChatGPT meal RPC
-> meals / meal_items
```

这条路径不改变浏览器安全边界，也不要求把数据库 secret 复制到聊天里。

## 2. 环境变量

服务端相关：

```text
DATA_EDIT_PASSWORD
SUPABASE_SECRET_KEY
```

兼容 / 可选：

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_URL
COUPLE_SPACE_SLUG
```

规则：

- secret key 不得写 Git；
- secret key 不得出现在客户端 bundle；
- secret key 不得复制到普通聊天内容作为 ChatGPT 持久化凭证；
- **禁止** `NEXT_PUBLIC_SUPABASE_SECRET_KEY`；
- `.env*` 已被 gitignore；
- 文档只写变量名，不写真实值。

旧 GitHub JSON 同步需要的 `GITHUB_TOKEN / GITHUB_DATA_FILE_PATH` 等不再是当前业务同步依赖。

## 3. Supabase 权限模型

当前 production base tables 均开启 RLS。

当前模式刻意不配置 anon/authenticated 业务 policy，因为浏览器不直接访问数据库；服务端使用 secret/service-role 权限。

当前 server-only meal RPC 已验证：

```text
service_role: execute
anon: no execute
authenticated: no execute
```

ChatGPT P2 新增：

```text
create_chatgpt_meal_record
get_chatgpt_meal_record
```

同样只允许 service-role 级调用，不向 `anon` / `authenticated` 开放。

`create_chatgpt_meal_record` 还额外要求：

- `chatgpt:` 前缀 idempotency key；
- 至少 1 个、最多 50 个 item；
- item 名称存在；
- kcal 为非负整数；
- item 热量区间合法；
- 整餐中心热量等于 item kcal 之和；
- RPC 强制 `source=chatgpt`、`status=confirmed`；
- 同 key 使用事务 advisory lock，降低并发重复写入风险。

以后如果加入 Supabase Auth，不要简单“给 authenticated 全开”，必须按 CoupleSpace membership 重做 policy。

## 4. Cloud session

cloud session 是共享同步密码验证后的 HttpOnly cookie。

安全目的：

- 避免每次读取都把 password 放 JS 请求体；
- 防止新设备未经读取就直接覆盖云端；
- 将浏览器和 Supabase secret 隔离。

它不等价于：

- 独立用户账号；
- 多角色权限；
- 可撤销设备 session 数据库；
- MFA。

ChatGPT P2 不复用或读取浏览器 HttpOnly cookie；它走用户已授权的连接器能力。

## 5. ChatGPT 持久化安全规则

### 未确认不写

讨论、图片分析、热量估算、修改估算都不允许触发数据库写入。只有明确保存意图，例如“记上”“把这餐记下来”，才进入写入路径。

### 不把 connector 变成通用数据库写入口

日常餐食聊天只调用受限的 ChatGPT meal RPC，不使用任意 SQL 去改游戏、钱包或其他表。

开发/排障时可以使用数据库管理工具，但必须区分“维护数据库”和“用户说记上”的产品路径。

### 重试必须复用幂等键

一次确认只生成一个 `chatgpt:` key。工具调用超时或返回不确定时：

1. 先按同 key 查询；
2. 已存在则视为成功；
3. 不存在才用同 key 重试；
4. 不允许换新 key 盲目重发。

### 角色不能猜

当前约定用户饮食聊天为 `fish`，伴侣专用饮食聊天为 `cat`。上下文不明确时不能猜角色后写入。

### 数据域隔离

ChatGPT meal RPC 只写饮食事实，不自动修改：

- deficit；
- 运动；
- 体重；
- wallet / ledger；
- coin / gem / heatmap。

## 6. 数据同步安全

### 当前主数据源

Supabase。

### 本地

localStorage 是运行缓存。同步失败时不应清空本地可用数据。

### 新设备

首次必须下载后才能上传。

### 本地 dirty

有未同步修改时，远端重新加载需要显式确认覆盖。

## 7. GitHub public JSON 历史

旧方案曾把完整兼容快照提交到：

```text
public/data/couple-data.json
```

该方案已经退出：

- 当前文件已删除；
- `/api/save-data` 不再写 GitHub；
- main 和旧 UI 分支的可达历史已重写；
- `.gitignore` 防止文件再次提交；
- 当前生产访问旧 `/data/couple-data.json` 无有效 cloud session 不再得到公开数据。

### 仍在跟进

GitHub 对失去分支引用的旧对象/cached views 不会立刻物理清除。

截至 2026-09-01：

- GitHub Support `Clear Cached Views` 工单已创建并处于 open；
- 等 Support 完成后需要再次验证旧 SHA URL 是否不可访问。

这属于外部平台清理，不应恢复代码层 GitHub 数据同步来“解决”。

## 8. 历史 Vercel 部署

Vercel 的旧 immutable deployment 可能对应历史代码版本。当前生产 alias 已指向安全版本，但仍应在后续安全巡检中确认：

- 旧部署是否受 Vercel Authentication 保护；
- 是否存在仍能匿名访问历史 JSON 的 deployment URL；
- 如平台支持，清理不需要的历史敏感 deployment。

当前不要把“production 已安全”自动等价为“所有历史 deployment 已物理删除”。

## 9. 备份与恢复

即使有 Supabase，也保留完整 JSON 导出：

- 是用户可控备份；
- 云端故障时可恢复；
- migration 前可做 checkpoint。

恢复是覆盖式导入，必须先确认；失败不能产生部分 state。

CSV 是复盘导出，不是恢复格式。

## 10. 部署前安全检查

```text
[ ] env 没进 Git
[ ] secret 没有 NEXT_PUBLIC 前缀
[ ] ChatGPT 流程没有把 secret/token 复制进聊天
[ ] data API 有 auth/session guard
[ ] RLS/grants 无意外开放
[ ] ChatGPT meal RPC 仍仅 service_role execute
[ ] 新设备保护仍存在
[ ] public/data/couple-data.json 不存在
[ ] migration 不包含真实个人数据
[ ] smoke test 数据已清理
```

## 11. 部署验证

对于影响 API / 数据库的变更，应验证：

1. Vercel deployment `READY`；
2. Next build / TypeScript 通过；
3. 未授权 API 返回 401；
4. 授权路径能正常读写；
5. Supabase 数据没有重复 / 丢失；
6. server-only RPC grants 正确；
7. smoke test 数据已清理；
8. 必要时检查 runtime logs。
