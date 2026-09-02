# 账户、双人绑定与迁移边界

> V2-R1B。本文描述生活系统从“共享同步密码”迁移到“两个真实账号 + 一个双人空间”的目标与当前实现。

## 1. 身份模型

```text
Supabase Auth user
        │
        ├─ life_user_profiles
        │
        └─ couple_space_members
              │
              ├─ couple_space_id
              └─ partner_key = cat | fish
```

一个 Auth user 是一个真实登录身份；`partner_key` 是该用户在双人空间里的业务身份。一个空间最多只有一个 `cat` 和一个 `fish`。

这意味着以后不允许“同一个浏览器凭一个共享密码同时假装我和 Ta”。个人记录的写权限必须由登录账号对应的 `partner_key` 决定。

## 2. 浏览器与 Supabase 边界

当前链路：

```text
Browser
  -> same-origin /api/auth/*
  -> Next.js server auth adapter
  -> Supabase Auth

Browser
  -> same-origin life/domain API
  -> account membership authorization
  -> service-side domain adapter / RPC
  -> Supabase PostgreSQL
```

安全规则：

- 浏览器不接触 `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`。
- Auth access token / refresh token 使用 HttpOnly、SameSite=Lax Cookie。
- `/api/auth/session` 用 Auth user endpoint重新验证当前账号，不把客户端缓存的 user object 当授权事实。
- 业务表目前仍然保持 server-only；本阶段没有为了登录功能开放浏览器直连生活表。

## 3. Auth 实现说明

Supabase 官方推荐 Next.js SSR 使用 `@supabase/supabase-js` + `@supabase/ssr`、Cookie session 与 Proxy 刷新机制。

R1B 当前为了不在连接器环境中手工重写 `package-lock.json`，先使用**服务端薄 HTTP 适配器**调用 Supabase 官方 Auth API：

- signup
- password login
- refresh token
- user validation
- logout

它不是自建认证协议：密码校验、token 发行与刷新全部仍由 Supabase Auth 完成。

后续若正式引入 npm 依赖，应直接迁移到 Supabase 官方 SSR client/proxy 模式，不再平行维护另一套 token 生命周期实现。

参考：

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs

## 4. 注册与登录

入口：`/login`

```text
注册
-> POST /api/auth/signup
-> Supabase Auth
-> auth.users
-> trigger 自动创建 life_user_profiles
-> 如果项目要求邮箱确认：等待确认后再登录

登录
-> POST /api/auth/login
-> Supabase Auth password grant
-> HttpOnly access/refresh cookies
-> /me
```

退出：

```text
POST /api/auth/logout
-> Supabase Auth logout
-> 清除两枚 Auth Cookie
```

## 5. 第一个账号迁移

生产数据库在 R1A 时 `auth.users = 0`，而原有生活数据已经存在于 `couple-better-game` 空间。因此不能自动猜测历史数据属于哪个新邮箱账号。

第一次迁移采用明确的一次性桥接：

1. 用户先注册并登录真实账号；
2. 在“我的”选择自己是 `cat` 或 `fish`；
3. 输入旧系统同步密码；
4. server 验证旧密码；
5. 仅当整个 membership 表仍为空时，把该 Auth user 写成现有空间的 owner。

一旦第一个 member 建立，bootstrap 会永久拒绝后续账号再走这条路径。

因此旧共享密码不能被第二个人拿来创建另一个身份。

## 6. Ta 如何加入

第一个成员在“我的”生成邀请码：

```text
POST /api/auth/pairing/invite
-> create_couple_space_invite
-> 生成随机 12 位十六进制邀请码
-> 数据库只保存 SHA-256(code)
-> 24 小时过期
```

Ta 注册自己的 Auth 账号后输入邀请码：

```text
POST /api/auth/pairing/accept
-> accept_couple_space_invite
-> 校验 hash / 未使用 / 未过期 / 目标身份槽为空
-> 插入 couple_space_members
-> 标记邀请码已使用
```

邀请码使用后不能重复使用。

## 7. 个人记录写权限

R1B 新增服务端规则：

```text
登录用户 partner_key == payload.partnerKey
    -> 允许个人记录写入

登录用户 partner_key != payload.partnerKey
    -> 403 OWN_RECORD_ONLY
```

当前已接入：

- mood
- sleep
- weight 新增

这为 R2 的“我只能修改自己的心情，Ta 的心情只读”提供真正的服务器权限基础。

仍需逐域迁移：

- meals：创建、修改、删除都要校验记录归属；
- mailbox：sender 必须由当前账号确定；
- activity：创建人与参与人语义需要明确。

在这些迁移完成前，不应删除旧兼容路径。

## 8. 旧 cloud-session 的状态

`DATA_EDIT_PASSWORD` / `couple-cloud-session` 现在是**迁移期兼容层**，不是目标登录系统。

保留原因：当前 Production 还没有真实 Auth 用户，立即删除会让现有两人数据在下一次部署前后失去可操作入口。

删除条件：

1. 两个真实账号均已注册；
2. 两个账号均已绑定到原有 couple space；
3. 所有个人/共享写 API 已完成账号权限迁移；
4. 旧游戏同步路径验证不依赖共享登录身份。

满足后单独做 migration/cleanup，删除共享密码认证。

## 9. 运行环境变量

现有 server secret 继续使用：

- `SUPABASE_SECRET_KEY`，或兼容 `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

Auth 还需要一个**可发布 key**，server adapter 支持以下任一名称：

- `SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- 兼容旧 `SUPABASE_ANON_KEY`
- 兼容旧 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

即使变量名含 `NEXT_PUBLIC_`，当前实现也仍只从服务端 adapter 使用；service/secret key 永远不能下发浏览器。

在下一次获得 Vercel 部署授权前，应先确认 Production 已配置可发布 key，否则登录 API 会返回 `SUPABASE_AUTH_CONFIG_MISSING`。

## 10. 部署规则

R1B 的 GitHub/Supabase 开发不等于 Vercel 部署。

`vercel.json` 必须默认保持 `git.deploymentEnabled: false`。任何 Preview 或 Production 仍须用户针对该次部署明确授权。
