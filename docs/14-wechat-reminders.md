# 微信提醒

状态：当前有效。

## 1. 当前链路

微信提醒与 ChatGPT / MCP 完全独立，直接由 Supabase 调度：

```text
Supabase pg_cron
→ reminder claim + 幂等 delivery ledger
→ Supabase Vault 读取当前身份的 PushPlus token
→ PostgreSQL HTTP
→ PushPlus
→ 微信
→ delivery ledger 回写 accepted / failed
```

网站没有打开时，提醒仍可按计划执行。

## 2. 双身份

```text
cat  → 只使用 cat 的 PushPlus token
fish → 只使用 fish 的 PushPlus token
```

客户端不能通过提交 actor、自称或 AI 昵称切换身份。token 加密保存在 Supabase Vault，页面和普通 API 不返回 token 明文。

## 3. 默认提醒

### 每日记录提醒

- 默认开启；
- 时区：`Asia/Shanghai`；
- 默认时间：21:15；
- 发送窗口：21:15 后约 20 分钟；
- Supabase 每 5 分钟检查一次；
- 当天本人已有心情、睡眠、餐食、体重，或本人参与/双方共同活动中的任一记录时，不再发送当天的缺记录提醒。

提醒文案保持低压力，不要求补全，也不做双方比较。

### 纪念日提醒

- 默认开启；
- 日期来源：`app_configs.anniversary_date`；
- 默认时间：09:15；
- 默认提前量：7 天、1 天、当天；
- 2 月 29 日在非闰年按 2 月 28 日处理。

## 4. token 管理

服务端使用 service-role RPC 管理提醒绑定：

```text
get_life_pushplus_status(actor)
set_life_pushplus_token(actor, token)
clear_life_pushplus_token(actor)
test_life_pushplus(actor)
```

status / test 响应不得包含 token 明文。

## 5. 幂等与失败

`life_notification_deliveries` 负责：

- dedupe，避免同一提醒重复发送；
- PushPlus 成功记录为 accepted，不伪装成用户已阅读；
- 失败允许按规则重试；
- 卡住的 reserved delivery 可以在超时后重新 claim。

微信提醒不依赖 MCP、Harbor Project 或任何 AI transport。AI 只可以通过正式业务能力修改提醒相关设置；提醒发送本身由 Supabase 调度完成。
