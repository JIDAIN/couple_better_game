# R10.1 微信提醒：Supabase 直发 PushPlus

## 当前状态

R10.1 已把微信提醒从 Harbor Apps Script Worker 中拆出。

当前生产数据库架构为：

```text
Supabase pg_cron（每 5 分钟）
  -> reminder claim + 幂等 delivery ledger
  -> 从 Supabase Vault 读取当前 actor 的 PushPlus token
  -> PostgreSQL http extension -> PushPlus
  -> 微信
  -> accepted / failed 回写 delivery ledger
```

这意味着：

- 微信提醒 **不再依赖 Google Apps Script**；
- Cat / Fish 各自拥有独立 PushPlus token；
- token 加密保存在 Supabase Vault；
- 页面和普通 API 永远不会把 token 读回客户端，只返回“已绑定/未绑定”；
- 即使网站没有打开，Supabase 也会继续按时检查；
- 没有配置 token 的 actor 会直接跳过，不会生成假的 reserved / accepted 记录。

Production 已执行 migration `r10_1_direct_pushplus_scheduler`。`life-pushplus-reminders-v1` cron job 已 active，频率 `*/5 * * * *`，并已观察到真实 cron run `succeeded`。

## 身份

- `cat`：AI 会话称呼 **团子**；
- `fish`：AI 会话称呼 **仔仔**；
- 团子 / 仔仔只是显示与会话称呼，授权身份始终由服务端登录态或固定 Bridge 身份决定。

Cat 和 Fish 的 PushPlus token 完全分开，因此：

```text
Cat 登录 -> 只能配置 cat 的微信提醒
Fish 登录 -> 只能配置 fish 的微信提醒
```

客户端不能提交 actor 来切换身份。

## 默认提醒规则

### 每日记录提醒

- 默认开启；
- 时区：`Asia/Shanghai`；
- 时间：21:15；
- 允许发送窗口：21:15 后 20 分钟；
- 每 5 分钟由 Supabase 检查一次；
- 当天本人已有以下任一记录，就不会发送：心情、睡眠、餐食、体重、本人参与或双方共同活动。

文案保持低压力：

> 今天还没有看到你的生活记录。记一点就好，不用补全，也不用和 Ta 比较。

### 纪念日提醒

- 默认开启；
- 数据源：`app_configs.anniversary_date`；
- 时间：09:15；
- 默认提前量：7 天、1 天、当天；
- 2 月 29 日在非闰年按 2 月 28 日处理。

## PushPlus token 安全

新增 Vault secret 名：

```text
life_pushplus_cat
life_pushplus_fish
```

只允许服务端 `service_role` 通过以下 RPC 管理：

```text
get_life_pushplus_status(actor)
set_life_pushplus_token(actor, token)
clear_life_pushplus_token(actor)
test_life_pushplus(actor)
```

其中 status / test 的响应都不包含 token。

生产网页新增：

```text
我的 -> 微信提醒
```

登录本人账号后可：

1. 粘贴本人 PushPlus token；
2. 保存 / 替换；
3. 发一条真实测试微信；
4. 解绑。

该网页代码需要一次经过用户明确授权的 Vercel Production 部署后才会出现在生产站。目前 Git 自动部署仍保持关闭。

## 幂等与失败处理

继续沿用 `life_notification_deliveries`：

- dedupe key 防止同一提醒重复发送；
- PushPlus 成功只记 `accepted`，不伪装成“微信用户已阅读”；
- 失败 5 分钟后允许重试；
- 最多 3 次；
- reserved 卡住 15 分钟后可重新 claim。

## 与 AI Bridge 的关系

R10.1 后两者完全独立：

```text
AI / Drive Bridge -> Apps Script（仅 AI 命令、Drive 原图、snapshot、备份）
微信提醒          -> Supabase -> PushPlus
```

因此 AI Worker 没部署不会影响微信提醒；PushPlus 没配置也不会影响 AI Bridge。

旧 `Reminder.gs` 已删除，`Pairing.gs` 配对成功后只运行 `setupR10Triggers()`。

## 完成定义

微信提醒后端完成：

- [x] notification tables / claim / ledger 已存在；
- [x] Vault actor token 机制已建立；
- [x] Supabase `http` / `pg_cron` 已启用；
- [x] 5 分钟 cron 已 active；
- [x] cron 实际执行成功；
- [x] Cat / Fish token 不互通；
- [x] 网页绑定 / 测试 / 解绑代码已加入 PR；
- [ ] PR CI 全绿并合并 main；
- [ ] 获得用户本次明确授权后部署 Vercel Production；
- [ ] Cat 绑定本人 token 并收到测试微信；
- [ ] Fish 绑定本人 token 并收到测试微信；
- [ ] 验证当天已有记录不会收到 daily reminder；
- [ ] 验证同一提醒不会重复发送。
