# 部署与安全

## 1. 当前生产架构

```text
Browser
  -> Next.js / Vercel same-origin API
  -> 固定双账号签名会话
  -> server-only domain service / restricted RPC
  -> Supabase PostgreSQL / Storage
```

浏览器不持有 Supabase service/secret key。账户设计见 `docs/17-auth-and-pairing.md`。

## 2. 环境变量

服务端：

```text
DATA_EDIT_PASSWORD
SUPABASE_URL
SUPABASE_SECRET_KEY
# 或兼容 SUPABASE_SERVICE_ROLE_KEY
```

固定双账号方案**不需要** Supabase publishable/anon key，也不需要开放注册。

规则：

- secret/service-role key 不得进入 Git；
- 禁止 `NEXT_PUBLIC_SUPABASE_SECRET_KEY`；
- 文档只写变量名，不写真实值；
- `.env*` 保持 gitignore。

## 3. 固定双账号登录

```text
我 -> cat
Ta -> fish
```

两人共用原 `DATA_EDIT_PASSWORD`。登录 API 只接受固定 `partnerKey` 和共享密码。

登录成功后，Next.js 写入 `life-account-session`：

- HttpOnly；
- SameSite=Lax；
- Production Secure；
- 30 天有效；
- payload 包含 `partnerKey` / expiresAt；
- 使用 HMAC-SHA256 签名；
- 签名秘密由共享密码与 Supabase server secret 派生。

浏览器不能修改 Cookie 中的 `cat/fish` 后继续通过服务端校验。

不提供：

```text
/api/auth/signup
/api/auth/bootstrap
/api/auth/pairing/*
```

只保留：

```text
/api/auth/login
/api/auth/session
/api/auth/logout
```

## 4. 个人写权限

业务 API 不能相信页面传入的 `partnerKey`。

```text
session.partnerKey == payload.partnerKey -> 允许
session.partnerKey != payload.partnerKey -> 403 OWN_RECORD_ONLY
```

已接入：mood / sleep / weight 新增。

后续：Meal、Mailbox、Activity 逐域收紧。

## 5. Supabase Auth 临时方案清理

R1B 曾短暂实现开放式 Supabase Auth + membership + invitation。产品复核后确认项目固定只有两位使用者，因此撤销。

生产检查时：

```text
life_user_profiles = 0
couple_space_members = 0
couple_space_invites = 0
```

随后执行 `remove_unused_auth_pairing` migration，删除这些空表、Auth trigger 和 pairing/bootstrap RPC，没有删除任何真实生活数据。

由于前两条 migration 已经真实执行过，仓库仍保留历史 migration，再通过 cleanup migration达到最终状态；不得篡改已执行 migration 历史。

## 6. RLS / server-only 表

大量业务表启用 RLS 但没有 anon/authenticated policy，这是当前 server-only 架构的刻意结果。Security Advisor 的 `RLS Enabled No Policy` INFO 说明：
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

不要为了消 INFO 而开放浏览器直连业务表。

## 7. 旧游戏与云同步

- Supabase 仍是生产事实源；
- `/game` 旧游戏继续独立；
- localStorage 仅缓存/旧游戏兼容；
- 旧 cloud-session 代码仅服务旧游戏同步路径，不再作为新版 Life API 身份；
- 新版 Life API 必须使用固定账号 signed session。

## 8. ChatGPT / AI 写入

继续坚持：

```text
讨论 / 估算 -> 不写
用户明确确认 -> domain validation -> restricted write -> read-back
```

AI 不获得任意 SQL 产品写入权限。

## 9. Vercel 部署审批

仓库默认：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

任何 Preview 或 Production 都必须针对该次部署重新取得用户明确授权。

## 10. 下一次部署前检查

```text
[ ] Git 自动部署仍关闭
[ ] Test / Lint / Build 全部通过
[ ] DATA_EDIT_PASSWORD / Supabase server secret 已配置
[ ] 登录只允许 cat / fish 两个固定账号
[ ] 无 signup / pairing / bootstrap 产品入口
[ ] 未登录 Life API -> 401
[ ] cat 不能写 fish 的个人记录，反之亦然
[ ] secret/service-role key 未进入浏览器
[ ] migration 不包含真实个人数据
[ ] Security Advisor 无新增意外高权限入口
[ ] 部署已获得本次明确授权
```
