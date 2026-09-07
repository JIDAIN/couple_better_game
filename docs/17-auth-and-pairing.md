# 固定双账号登录与权限边界

项目只有两位固定使用者，不开放注册、不做邀请码，也不再把“同步密码”当成生活系统登录步骤。

## 1. 固定身份

底层身份仍然只有：

```text
cat
fish
```

进入应用以后，“我 / Ta”相对当前登录账号解释：

```text
cat 登录：我 = cat，Ta = fish
fish 登录：我 = fish，Ta = cat
```

数据库继续保存稳定的 `cat / fish`，业务页面统一消费 `mePartnerKey / taPartnerKey`。

## 2. 登录页

登录页保持最普通的账号密码形式：

```text
账号
密码
登录
```

不再出现：

- 先选择猫猫 / 鱼鱼；
- “连接云端”；
- 同步密码输入框；
- 注册；
- 邀请码。

账号和密码由 Supabase 中的固定双账号凭据校验；真实账号值和密码不写入公开 GitHub。

## 3. Supabase 固定账号凭据

Production Supabase 使用 `public.life_fixed_accounts` 保存两条固定账号记录：

```text
partner_key = cat / fish
username    = 登录账号
password_hash = bcrypt hash
```

密码只保存 bcrypt hash，不保存明文。

登录 API 调用 server-only RPC：

```text
public.authenticate_fixed_life_account(username, password)
```

该 RPC：

- 使用 `extensions.crypt()` 校验密码；
- 只返回 `cat / fish / null`；
- `anon`、`authenticated` 无执行权；
- 只有 `service_role` 可以调用；
- 浏览器不能直接读取凭据表。

真实凭据通过 Production 数据写入维护，不进入 migration seed 和公开仓库。

## 4. Session 与 MCP OAuth

网页登录成功后服务器生成 `life-account-session` HttpOnly Cookie：

- HttpOnly；
- SameSite=Lax；
- Production 下 Secure；
- 30 天有效；
- payload 只保存 `partnerKey` 和到期时间；
- HMAC-SHA256 使用 Supabase server secret + 固定域分隔符签名；
- Session 签名不依赖用户密码或旧同步密码。

MCP OAuth 同样把 `partnerKey` 写入签名后的 authorization code / access token / refresh token。AI 昵称、用户自称、`person=cat/fish` 等普通参数都不能改变 OAuth 身份。

## 5. 云端数据

生活系统登录成功后直接访问 Supabase-backed Life API，不再经过 `LifeCloudGate`。

未登录 / session 失效：

```text
Life API -> 401
前端 -> /login
```

`hasCloudSyncConfig()` 只检查 Supabase 服务端 URL / secret，不再要求 `DATA_EDIT_PASSWORD`。

旧 `/game` 的历史同步兼容代码可以暂时保留，但不能再出现在新版生活系统的正常使用路径里。

## 6. 权限总原则

个人数据写入由服务器按当前签名 session / OAuth identity 限制：

```text
current partnerKey == record owner -> 允许
current partnerKey != record owner -> 403 OWN_RECORD_ONLY
```

因此：

```text
当前登录的人 = 我 = 可修改自己的个人记录
另一方       = Ta = 可以按产品需要查看，但不能改写 Ta 的个人记录
```

不能把“前端没显示按钮”当成权限。Web API、AI Access Core 和数据库 RPC 都必须独立保住写边界。

## 7. 当前资源权限矩阵

| 资源 | 读取 | 写入规则 |
|---|---|---|
| mood | 双方可查看 | 只能 upsert / delete 自己 |
| sleep | 双方可查看 | 只能 upsert 自己 |
| meal / photo | 双方可查看 | 只能新增、修改、删除自己的餐食和照片 |
| weight | 双方可查看 | 只能新增、修改、删除自己的体重 |
| activity: cat / fish | 双方可按页面语义查看 | 只有 participant 对应本人可以新增、修改、删除 |
| activity: both | 双方可查看 | 双方都可以维护；不能由单方静默改成 cat-only / fish-only |
| medicine | 家庭共享 | 双方都可维护 |
| mailbox | 收件 / 已寄出可查看 | 发件人由当前身份固定；只有发件人可修改/删除当前旧模型中的信件 |
| settings.targetWeightKg | 双方可查看 | 只修改当前账号自己的目标体重 |
| settings.anniversaryDate | 双方共享 | 双方都可维护 |
| reminders | 当前账号看自己的实例 | 实例操作绑定当前账号；自定义提醒可以显式选择 cat / fish / both 作为收件人 |
| PushPlus token | 只看自己是否已绑定 | 只能绑定/替换/解绑当前账号自己的 token |

`medicine`、纪念日、双方活动等是明确的 couple-space 共享业务，不套用个人记录的 owner-only 规则。

## 8. Activity 特殊规则

`activity_entries` 以 `participant_scope` 表达归属：

```text
cat  -> Cat 的个人活动
fish -> Fish 的个人活动
both -> 双方共同活动
```

权限规则：

```text
Cat 不能创建 / 修改 / 删除 fish-only 活动
Fish 不能创建 / 修改 / 删除 cat-only 活动
both 活动双方都可修改 / 删除
both 活动不能被任一方直接改成单方活动
个人活动可以由本人升级为 both
```

服务端使用 actor-aware RPC 再次校验这些规则，不相信浏览器或 AI 自己声明的 `participantScope`。

## 9. Weight 特殊规则

新增、修改和删除体重都同时校验：

```text
signed actor
existing row partner_key
payload partnerKey
```

三者必须一致。旧游戏关联的 legacy-linked weight 继续受原有“只能由 daily check-in 管理”的限制。

## 10. AI / MCP 边界

MCP 与网页内置 AI 都经过 `life-agent-executor`。个人 mutation 显式指定 Ta 会被拒绝；update/delete 还会先读取真实记录 owner/scope，而不是只相信工具参数。

Activity 额外规则：

- 修改 Ta 的个人活动：拒绝；
- 删除 Ta 的个人活动：拒绝；
- shared activity 保持 `both`：允许；
- shared activity 改成单方：拒绝。

删除操作还要求用户当前自然语言消息明确表达删除意图。

## 11. 数据库权限

生活数据表继续保持：

```text
RLS enabled
+ anon/authenticated 无直接表权限
+ service_role / canonical RPC 访问
```

actor-aware activity / weight RPC 同样只授予 `service_role` EXECUTE；浏览器不能绕过服务器直接调用这些写接口。

## 12. 不允许重新引入的复杂流程

- 登录前账号卡片选择；
- 第二次同步密码；
- 注册 / 邮箱验证；
- 邀请码 / 配对流程；
- 第三个账号。

## 13. 部署规则

`vercel.json` 默认必须保持 `git.deploymentEnabled: false`。任何 Preview / Production 仍需单次明确授权。
