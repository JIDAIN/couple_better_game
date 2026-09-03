# R10 Production 上线记录

**上线日期：2026-09-03**

## 1. 当前 Production 部署

用户已明确授权将 R8.1 + R10 Worker Pairing + 双 Harbor + 微信提醒统一部署到 Production。

本次受控部署通过临时打开 `vercel.json` 的 Git deployment 开关触发一次 main Production，Vercel 创建部署后立即恢复为关闭。

Vercel Production：

```text
deployment: dpl_3WHMG5Voo9YRgHByxjKHZQKHgT43
state: READY
target: production
source commit: 3775d90311b11f4d39e93b816e13f5332e1efff5
primary domain: https://couple-better-game.vercel.app
```

该 source commit 的业务代码基线包含此前 main 的：

```text
Worker Pairing: 7028cd9392b4b99599b02b977bbc0803b351b195
R8.1 UI:       52aebad2c28560958d055b06522b8b95b82eda39
Docs closeout: 007f0e0d8ec4c2831c3e02908e2d941ae8206c26
```

随后已恢复：

```text
main commit: ee4a08fb44f65f20a12f61f9e4acda6f95339548
vercel.json -> git.deploymentEnabled=false
```

部署后检查表明，自本次授权开始只产生了一个新的 Vercel deployment。

## 2. 已上线能力

当前 Production 已同时包含：

- R8.1 视觉与交互 23 项收口；
- 首页共享纪念日与“一起度过的第 N 天”；
- 8h 睡眠满环；
- 活动新增/编辑分离和丰富活动类型；
- 紧凑餐食编辑与宏量营养布局；
- 历史日期复用首页卡片；
- 体重日均趋势和周/月/季度/年切换；
- 信箱标题/主题/筛选/阅读器；
- 紧凑家庭药箱；
- R10 Google Drive / Sheets Bridge；
- Harbor Cat / Harbor Fish 双入口；
- actor-specific HMAC、watch、wake；
- 一次性 Sheet-bound Worker Pairing；
- Drive 原图 + Supabase 临时 staging + 600px WebP 展示图；
- 单一家庭 Daily / Monthly 备份；
- Harbor Cat AI 称呼“团子”；
- Harbor Fish AI 称呼“仔仔”；
- PushPlus 微信提醒后端与 Apps Script worker 代码；
- R9 `/ai` 备用入口与 `/mcp`。

## 3. 构建与 HTTP 验收

Vercel 构建成功：

```text
Next.js 16.2.6
Compiled successfully
TypeScript finished
24/24 static pages generated
Deployment completed
```

关键生产路由已生成：

```text
/api/drive-bridge/bootstrap
/api/drive-bridge/execute
/api/drive-bridge/reminders
/api/drive-bridge/snapshot
/api/drive-bridge/stage
/api/drive-bridge/watch
/api/life/settings
/ai
/mcp
```

上线后实测：

```text
GET / -> 200 OK
GET /api/drive-bridge/bootstrap -> 405 Method Not Allowed
```

`bootstrap` 是 POST-only，因此 405 是预期结果，证明 Worker Pairing 新路由已经命中 Production。

Vercel runtime error 检查：

```text
No error/fatal runtime logs found
```

## 4. Supabase Production 状态

R10 bridge、pairing、微信提醒相关 migration 均已执行 Production。

双 Harbor server-only config：

```text
cat  -> actor=cat,  backup_leader=true
fish -> actor=fish, backup_leader=false
```

当前 Worker 尚未真正创建，因此：

```text
cat.apps_script_url  = empty
fish.apps_script_url = empty
```

两张 Bridge Sheet 当前均已准备好一次性 pairing code，状态为 `ready`；长期 HMAC/watch/wake secret 不进入 Sheet 或聊天。

微信提醒默认配置：

```text
timezone: Asia/Shanghai
daily record: 21:15
anniversary: 09:15
offsets: [7, 1, 0]
```

## 5. Harbor AI 身份

```text
Harbor Cat
AI 会话称呼 = 团子
authoritative actor = cat
Ta = fish

Harbor Fish
AI 会话称呼 = 仔仔
authoritative actor = fish
Ta = cat
```

“团子 / 仔仔”只帮助自然语言和 Project 会话识别，不能覆盖服务端 `cat / fish` 权限绑定。

## 6. 当前唯一剩余外部步骤

Production 后端、R8.1 UI 和 Worker Pairing 均已经上线。R10 现在只差 Google Apps Script Worker 的一次性人工创建，因为当前 ChatGPT Google Drive connector 不提供 Apps Script 项目创建/部署权限。

需要完成：

1. 在 `Couple Better Game AI Bridge - Cat` 的 bound Apps Script 中放入 `Code.gs / Reminder.gs / Pairing.gs`；
2. 部署为 Web App：Execute as Me，Who has access Anyone；
3. 运行 `setupR10Pairing()`，让 Cat Worker 自动交换长期 secret、清空 pairing code、回填 `apps_script_url`、安装 triggers 并刷新 `STATE_*`；
4. Fish 按相同流程操作；
5. Cat/Fish 分别把自己的 `PUSHPLUS_TOKEN` 放入各自 Script Properties，再运行 `setupWechatReminderTrigger()`；
6. 做真实读写、原图、watch、1 分钟 fallback、备份与微信提醒验收。

只有上述 Worker 激活和端到端测试完成后，R10 才标记为 fully operational。
