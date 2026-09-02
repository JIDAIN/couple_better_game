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

当前固定账号名为 `cat / fish`，同时兼容输入 `猫猫 / 鱼鱼`。

登录密码读取顺序：

```text
LIFE_CAT_PASSWORD / LIFE_FISH_PASSWORD   # 如需两账号分别配置
LIFE_ACCOUNT_PASSWORD                    # 两账号共用账号密码
DATA_EDIT_PASSWORD                       # 旧配置兼容兜底
```

`DATA_EDIT_PASSWORD` 只作为旧部署兼容，不再代表产品上需要用户额外输入一次“同步密码”。

## 3. Session

登录成功后服务器生成 `life-account-session` HttpOnly Cookie：

- HttpOnly；
- SameSite=Lax；
- Production 下 Secure；
- 30 天有效；
- payload 只保存 `partnerKey` 和到期时间；
- HMAC-SHA256 只使用 Supabase server secret + 固定域分隔符签名，不再依赖同步密码。

## 4. 云端数据

生活系统登录成功后直接访问 Supabase-backed Life API，不再经过 `LifeCloudGate`。

未登录 / session 失效：

```text
Life API -> 401
前端 -> /login
```

`hasCloudSyncConfig()` 只检查 Supabase 服务端 URL / secret，不再要求 `DATA_EDIT_PASSWORD`。

旧 `/game` 的历史同步兼容代码可以暂时保留，但不能再出现在新版生活系统的正常使用路径里。

## 5. 权限

个人数据写入仍由服务器按当前 session 限制：

```text
current partnerKey == record partnerKey -> 允许
current partnerKey != record partnerKey -> 403 OWN_RECORD_ONLY
```

因此：

```text
当前登录的人 = 我 = 可修改自己的个人记录
另一方       = Ta = 查看为主
```

共享数据仍属于同一个 couple space。

## 6. 不允许重新引入的复杂流程

- 登录前账号卡片选择；
- 第二次同步密码；
- 注册 / 邮箱验证；
- 邀请码 / 配对流程；
- 第三个账号。

## 7. 部署规则

`vercel.json` 默认必须保持 `git.deploymentEnabled: false`。任何 Preview / Production 仍需单次明确授权。
