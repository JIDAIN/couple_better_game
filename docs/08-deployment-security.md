# 部署与安全

## 1. 当前生产架构

```text
Browser
  -> Next.js / Vercel same-origin API
  -> Supabase Auth identity + server authorization
  -> server-only domain service / restricted RPC
  -> Supabase PostgreSQL / Storage
```

浏览器不持有 Supabase service/secret key。ChatGPT 写入也只能通过已经定义的领域协议与受限 RPC，不能把任意 SQL 当作日常产品写入接口。

账户与配对的详细设计见 `docs/17-auth-and-pairing.md`。

## 2. 环境变量

服务端 secret：

```text
SUPABASE_SECRET_KEY
# 或兼容：SUPABASE_SERVICE_ROLE_KEY
DATA_EDIT_PASSWORD      # 仅迁移期/旧系统兼容
```

Supabase 地址：

```text
SUPABASE_URL
# 或兼容：NEXT_PUBLIC_SUPABASE_URL
```

R1B Auth 还需要一个 Supabase 可发布 key，支持以下任一变量名：

```text
SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

规则：

- secret/service-role key 不得进入 Git；
- 禁止 `NEXT_PUBLIC_SUPABASE_SECRET_KEY`；
- 文档只写变量名，不写真实值；
- `.env*` 保持 gitignore；
- 下一次 Vercel 部署前必须确认 Production 已配置 Auth 可发布 key，否则 `/api/auth/*` 无法工作。

## 3. Supabase Auth 与 Cookie

R1B 的密码验证、账号创建、access token、refresh token 均由 Supabase Auth 完成。

浏览器只访问本站：

```text
/api/auth/signup
/api/auth/login
/api/auth/session
/api/auth/logout
/api/auth/bootstrap
/api/auth/pairing/invite
/api/auth/pairing/accept
```

access/refresh token 由 Next.js 写入 HttpOnly、SameSite=Lax Cookie；不要求页面 JavaScript 保存 token 到 localStorage。

当前实现为服务端薄 HTTP adapter。正式引入 `@supabase/ssr` 后，应切换到 Supabase 官方 SSR client/proxy session refresh 方案，而不是发展自定义 token 协议。

## 4. 双人空间权限

```text
Auth user
-> couple_space_members
-> couple_space_id + partner_key(cat|fish)
```

个人数据写入不能仅相信客户端传入的 `partnerKey`。

当前已开始执行：

```text
登录身份 == payload.partnerKey -> 允许
登录身份 != payload.partnerKey -> 403 OWN_RECORD_ONLY
```

已接入 mood / sleep / weight 新增写入。Meal、Mailbox、Activity 继续逐域迁移。

## 5. 首次迁移与邀请码

第一个真实账号的历史数据迁移绑定只能通过 `/api/auth/bootstrap`：

- 必须已经 Supabase Auth 登录；
- 必须提供旧系统同步密码；
- membership 表必须仍为空；
- 只能绑定一次。

数据库中曾存在的 `bootstrap_couple_space_membership` SECURITY DEFINER RPC 已撤销 `authenticated` 执行权，防止绕过 Next.js 的迁移密码验证。

第二个账号只能使用一次性邀请码加入：

- 12 位随机十六进制码；
- 24 小时有效；
- 数据库只存 SHA-256 摘要；
- 使用后立即失效；
- 目标 `cat/fish` 槽必须为空。

`create_couple_space_invite` / `accept_couple_space_invite` 是**有意暴露给 authenticated 的窄 SECURITY DEFINER RPC**：它们都基于 `auth.uid()`、成员身份、角色槽、过期时间和一次性状态限制能力，不向 `anon` 开放。Supabase Security Advisor 因此会对这两个函数报告 lint 0029；这是已审查的有意例外，而不是未发现的开放权限。参考：https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0029_authenticated_security_definer_function_executable

## 6. RLS / server-only 表

大量现有业务表启用了 RLS 但没有 anon/authenticated policy，这是当前 server-only 架构的刻意结果，而不是要求立刻“补一个开放 policy”。

Security Advisor 会显示 `RLS Enabled No Policy` INFO：
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

不要为了消掉 INFO 而允许浏览器直接读写业务表。

## 7. 旧 cloud-session

`DATA_EDIT_PASSWORD` + `couple-cloud-session` 不再是目标账户系统，只保留为迁移兼容：

- 两个真实 Auth 账号尚未创建前，不能突然锁死现有生产数据；
- 第一个账号迁移绑定仍需要旧同步密码证明；
- `/game` 旧游戏的稳定同步路径暂不在 R1B 强制重写。

删除条件见 `docs/17-auth-and-pairing.md`。完成双账号迁移和各领域权限迁移后必须删除这条兼容路径。

## 8. ChatGPT / AI 写入

继续坚持：

```text
讨论 / 估算 -> 不写
用户明确确认 -> 领域 validation -> restricted write -> read-back
```

AI 不获得任意数据库管理能力；Meal 等领域继续使用幂等键，不能因超时换新 key 盲目重复写入。

## 9. 数据同步与恢复

- Supabase 是生产事实源；
- localStorage 仅运行缓存/旧游戏兼容；
- 同步失败不能清空本地可用状态；
- 新设备保护、dirty reload guard、JSON 备份继续保留；
- CSV 仅用于复盘，不作为恢复格式。

## 10. Vercel 部署审批

仓库默认必须保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

任何 Preview 或 Production 都需要用户针对该次部署明确授权。此前一次 Production 授权已经使用完毕，不自动延续到本轮重构。

## 11. 下一次部署前检查

```text
[ ] Git 自动部署仍关闭
[ ] Test / Lint / Build 全部通过
[ ] Production 已配置 Supabase publishable/anon key
[ ] secret/service-role key 未进入浏览器
[ ] Auth 未登录 -> session 为 unauthenticated
[ ] 已登录未绑定 -> 业务 API 返回 PAIRING_REQUIRED
[ ] 已绑定账号不能写 Ta 的个人记录
[ ] bootstrap 不能被 authenticated 直接 RPC 绕过
[ ] invite RPC anon 无 execute
[ ] migration 不包含真实个人数据
[ ] Security Advisor 没有新增意外高权限入口
[ ] 部署本身已获得本次明确授权
```
