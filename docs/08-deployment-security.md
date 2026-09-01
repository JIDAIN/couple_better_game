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

## 5. 数据同步安全

### 当前主数据源

Supabase。

### 本地

localStorage 是运行缓存。同步失败时不应清空本地可用数据。

### 新设备

首次必须下载后才能上传。

### 本地 dirty

有未同步修改时，远端重新加载需要显式确认覆盖。

## 6. GitHub public JSON 历史

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

## 7. 历史 Vercel 部署

Vercel 的旧 immutable deployment 可能对应历史代码版本。当前生产 alias 已指向安全版本，但仍应在后续安全巡检中确认：

- 旧部署是否受 Vercel Authentication 保护；
- 是否存在仍能匿名访问历史 JSON 的 deployment URL；
- 如平台支持，清理不需要的历史敏感 deployment。

当前不要把“production 已安全”自动等价为“所有历史 deployment 已物理删除”。

## 8. 备份与恢复

即使有 Supabase，也保留完整 JSON 导出：

- 是用户可控备份；
- 云端故障时可恢复；
- migration 前可做 checkpoint。

恢复是覆盖式导入，必须先确认；失败不能产生部分 state。

CSV 是复盘导出，不是恢复格式。

## 9. 部署前安全检查

```text
[ ] env 没进 Git
[ ] secret 没有 NEXT_PUBLIC 前缀
[ ] data API 有 auth/session guard
[ ] RLS/grants 无意外开放
[ ] 新设备保护仍存在
[ ] public/data/couple-data.json 不存在
[ ] migration 不包含真实个人数据
[ ] smoke test 数据已清理
```

## 10. 部署验证

对于影响 API / 数据库的变更，应验证：

1. Vercel deployment `READY`；
2. Next build / TypeScript 通过；
3. 未授权 API 返回 401；
4. 授权路径能正常读写；
5. Supabase 数据没有重复 / 丢失；
6. 必要时检查 runtime logs。
