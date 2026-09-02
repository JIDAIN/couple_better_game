# 固定双账号登录与权限边界

> V2-R1B 最终方案。项目只有两位固定使用者，不做开放注册，也不做邀请码配对。

## 1. 产品约束

底层账号永远只有两个：

```text
cat
fish
```

两个人继续复用旧程序同一个 `DATA_EDIT_PASSWORD`。区分身份的关键不是密码，而是“选择哪个固定账号登录”。

**前端的“我 / Ta”不是固定映射到 cat / fish，而是相对当前登录账号动态解释：**

```text
cat 登录：
我 = cat
Ta = fish

fish 登录：
我 = fish
Ta = cat
```

因此数据库继续保存稳定的 `cat / fish`，而所有生活页面只把当前会话的 `partnerKey` 称为“我”，把另一方称为“Ta”。

不提供：

- 用户自由注册；
- 第三个账号；
- 邮箱验证；
- 24 小时邀请码；
- CoupleSpace 配对流程。

## 2. 登录流程

```text
/login
-> 选择固定账号“猫猫（cat）”或“鱼鱼（fish）”
-> 输入旧程序共享密码
-> POST /api/auth/login
-> server 校验 DATA_EDIT_PASSWORD
-> server 生成带 partnerKey 的签名 HttpOnly Cookie
-> 后续 API 从 Cookie 解析当前身份
```

登录页不能在身份尚未确定前把 cat 写成“我”、fish 写成“Ta”；登录页使用稳定账号名。进入应用以后再根据当前 session 动态生成 `mePartnerKey / taPartnerKey`。

Cookie：

- HttpOnly；
- SameSite=Lax；
- Production 下 Secure；
- 30 天有效；
- payload 包含 `partnerKey` 和到期时间；
- HMAC-SHA256 签名密钥由 `DATA_EDIT_PASSWORD + Supabase server secret + 固定域分隔符` 派生；
- 浏览器无法伪造从 `cat` 切换为 `fish`。

退出登录只清除该 Cookie。

## 3. 相对身份解析层

`LifeAppShell` 提供统一身份 Context：

```text
currentPartnerKey = 当前登录账号
mePartnerKey      = currentPartnerKey
taPartnerKey      = opposite(currentPartnerKey)
```

所有出现“我 / Ta”的页面必须消费这一层，禁止再出现：

```text
const SELF_KEY = "cat"
const TA_KEY = "fish"
```

当前已接入：

- 今日心情；
- 饮食；
- 日历月页；
- 日历详情；
- 体重；
- 小信箱。

后续新增页面也必须使用相同规则。

## 4. 数据权限

所有生活数据仍然通过：

```text
Browser
-> Next.js same-origin API
-> fixed account session authorization
-> service-side Supabase adapter / RPC
-> PostgreSQL
```

个人记录写权限：

```text
当前登录 partnerKey == payload.partnerKey
  -> 允许

当前登录 partnerKey != payload.partnerKey
  -> 403 OWN_RECORD_ONLY
```

这和前端相对身份配合后意味着：

```text
当前登录的人 = 我 = 可编辑自己的个人记录
另一方       = Ta = 查看为主
```

当前已接入服务端个人写权限的有：

- 心情；
- 睡眠；
- 体重新增。

## 5. 共享数据

固定账号只是写权限身份，不代表两个人的数据彼此隔离不可见。

两个人继续共享同一个 `couple-better-game` 生活空间，因此：

- 日历可以同时看双方记录；
- 家庭药箱共同可见；
- 小信箱共同可见；
- 游戏数据共同可见；
- 饮食页可以切换查看我 / Ta；
- 个人敏感写操作由当前账号限制。

## 6. 与旧程序的关系

旧程序长期使用的是 `cat / fish` 两个业务身份和同一套共享密码。R1B 直接把这两个既有身份变成真正的登录会话身份。

这样保持：

```text
旧身份语义不变
旧密码不变
历史数据 partnerKey 不变
```

同时新增：

```text
服务端知道当前是谁
UI 中“我 / Ta”随当前账号切换
不能通过前端切换按钮冒充另一方写个人记录
```

## 7. 数据库迁移历史

由于前一版 R1B migration 已经实际应用到 Production，migration 文件不能从 Git 历史中假装不存在。

因此仓库保留：

1. 创建 Auth/membership/invite schema 的已执行 migration；
2. 权限 hardening migration；
3. `remove_unused_auth_pairing` cleanup migration。

最终 Production 状态不再存在：

- `life_user_profiles`；
- `couple_space_members`；
- `couple_space_invites`；
- Auth profile trigger；
- pairing/bootstrap RPC。

## 8. 环境变量

固定双账号方案不需要 Supabase publishable/anon key。

继续需要服务端已有配置：

```text
DATA_EDIT_PASSWORD
SUPABASE_URL
SUPABASE_SECRET_KEY
```

兼容：

```text
SUPABASE_SERVICE_ROLE_KEY
```

这些 secret 不允许进入客户端 bundle。

## 9. 部署规则

`vercel.json` 默认保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

任何 Preview / Production 仍必须取得用户针对该次部署的明确授权。
