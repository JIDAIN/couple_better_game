# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细重构计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；R1-R6 分阶段说明见 `docs/18-*` 至 `docs/23-*`；AI 总架构见 `docs/11-ai-write-architecture.md`；R10 细节见 `docs/25-r10-chatgpt-project-drive-bridge.md`。

## 1. V2 主功能与重构状态

```text
V2-P0  新旧系统边界 /game                    ✅
V2-P1  心情 / 睡眠 / 活动 facts + API         ✅
V2-UI0/1 岛屿生活视觉语言 + App* 基础         ✅
V2-P2  今日首页                               ✅
V2-P3  独立饮食 + 编辑 + 照片                  ✅
V2-P4  月历 + 日期详情                         ✅
V2-P5  小窝 + 体重                             ✅
V2-P6  家庭药箱                                ✅
V2-P7  小信箱                                  ✅
V2-P8  游戏机列表 -> /game                     ✅
V2-P11 全站代码边界联调                         ✅
R1-R6 重构                                    ✅
R7 移动端视觉与实机校准                         ✅
R8 数据管理 + AI/MCP Production 接入            ✅
R9 程序内置 AI Agent（代码/CI）                  ✅
R9 Production 实机                              ⏳ 未部署
R10 ChatGPT Project × Drive Bridge（开发/CI）    🚧 本分支开发中
R10 Production 激活                              ⏳ 待单次授权
```

## 2. R1-R6 最终结果

- 固定 `cat / fish` 两个底层身份；登录后“我 / Ta”相对当前账号动态解释。
- 当前 Tab 重复点击不再同路由导航；Life identity 与 query cache 跨页面保持。
- 心情 / 睡眠只编辑自己；Ta 只读。
- 三餐固定餐次；加餐 `0..N`；Meal/照片写入按 session + owner 校验。
- 日历空日期留白、今天小太阳、双人心情直接落在日期下方。
- 小窝只放共同生活内容；我的只放当前账号 / 数据 / 设置 / 退出。
- 全站采用岛屿生活视觉语言 V2 · 方案B。

PR #35 最终统一 Test / Lint / Build 均通过后已合并。

## 3. 固定双账号与登录

当前登录为标准账号密码方式：

```text
/login
账号
密码
登录
```

已完成：

- 登录 API 接收 `username + password`；
- Today 401 直接回 `/login`，不再出现“连接云端 / 同步密码”；
- session HMAC 与同步密码解耦；
- Production Supabase `life_fixed_accounts` 保存两个固定账号并分别绑定 `cat / fish`；
- 密码只保存 bcrypt hash，不保存明文；
- `authenticate_fixed_life_account` 只授予 `service_role`；
- 真实账号数据不写入 GitHub migration/seed。

## 4. 安全与数据边界

```text
Browser manual UI
  -> same-origin Next.js API
  -> fixed account signed session
  -> server-only domain service / RPC
  -> Supabase PostgreSQL

ChatGPT Project（R10 主路径）
  -> Google Drive / Sheets App
  -> AI Bridge Sheet
  -> Apps Script signed worker
  -> /api/drive-bridge/*
  -> life_query / life_mutate
  -> canonical domain service / RPC
  -> Supabase PostgreSQL / Storage

Browser /ai（R9 备用）
  -> fixed account signed session
  -> server-only AI Gateway call
  -> life_query / life_mutate registry
  -> canonical domain service / RPC
  -> Supabase PostgreSQL / Storage

External MCP client（R8 可选）
  -> OAuth 2.1 / PKCE
  -> /mcp
  -> domain adapter
  -> canonical domain service / RPC
```

- Supabase service secret 永不进入浏览器、Google Sheet、普通聊天或模型上下文；
- R10 Bridge 使用独立 HMAC、固定身份与 durable command ledger；
- AI 不相信模型提供的个人 owner；
- 不暴露任意 SQL、任意 Supabase 请求或任意 URL 下载工具；
- Supabase 仍是事实源；Google Sheet 只是命令总线和状态镜像；
- GitHub 不保存真实生活数据、原图或生产 secret。

## 5. 依赖提示

当前 lockfile 的 `npm ci` 仍报告 `9 vulnerabilities (1 low, 8 high)`。本轮没有使用 `npm audit fix --force` 做破坏性升级；依赖安全升级应作为独立 dependency-audit 处理。

## 6. R7 实机视觉校准

R7 已完成移动端主宽度、卡片、导航、心情图标、日历、小信箱、账号缓存与常用页面收口。`excited` migration 已在 Production 执行并验证。详细记录见 `docs/24-r7-mobile-ui-calibration.md`。

## 7. R8 数据管理与 MCP

R8 Production Supabase 已执行：

```text
20260903020502  r8_data_management_life_refinement
20260903023150  r8_mcp_redemption_rls
```

包括生活设置、transactional backup/export/restore/import、MCP code redemption 与 RLS。

PR #40 已合并，merge commit：

```text
6b904beb1f5ae6073ea4c5fa53be900e4042309f
```

R8 Production MCP：

```text
https://couple-better-game.vercel.app/mcp
```

最终 R8 Production：

```text
dpl_FvWJfrmtH1fcVie8UsXT4Ez871tD
READY
https://couple-better-game.vercel.app
```

MCP/OAuth 服务端 discovery / 401 challenge 已验证；但个人 ChatGPT Plus 的自定义 MCP 写入能力不满足本项目目标，因此 R10 改走官方 Google Drive App Bridge。

## 8. R9 程序内置 AI Agent

R9 已建立：

```text
/ai
/api/ai/chat
Vercel AI Gateway
life_capabilities / life_query / life_mutate
```

AI 可读取 V2 export/settings/legacy snapshot，并按当前身份 CRUD Mood、Sleep、Activity、Meal、Weight、Medicine、Mailbox、Settings 等已注册领域。

权限回归覆盖 owner 强制、删除意图、小信箱 owner 与 legacy 强确认。

PR #41 最终 CI run #223：

```text
Test   ✅
Lint   ✅
Build  ✅
```

PR #41 已合并到 main，merge commit：

```text
6989042c1164f1140bdb151e351c4406ad417b34
```

**R9 未部署 Production。** 当前线上仍是 R8，不能声称线上 AI Gateway/writeback 已验收。

## 9. R10 ChatGPT Project × Google Drive Bridge

R10 目标：不升级 ChatGPT 套餐，让 `🐟🐱生活` Project 的任意新聊天通过已连接 Google Drive / Sheets App 读取和修改程序。

已创建 Google Drive 工作区：

```text
Couple Better Game/
├─ AI-Bridge/
├─ Originals/Meals/
├─ Backups/Daily/
├─ Backups/Monthly/
└─ Trash/
```

已创建原生 Google Sheet：

```text
Couple Better Game AI Bridge
ID: 1inEL4mXOQ2-w5UrkqtLoK6aU2o-4auCQSLlEGuA3cVo
```

Sheet 已包含：`README / META / COMMANDS / RECEIPTS / STATE_* / ASSETS`。

当前主 Bridge 固定绑定 `cat`，不允许 Sheet 自行传 `actor=fish` 冒充 Ta。

R10 服务端代码已新增：

```text
/api/drive-bridge/execute
/api/drive-bridge/snapshot
/api/drive-bridge/watch
lib/server/drive-bridge-auth.ts
lib/server/drive-bridge-service.ts
lib/server/drive-bridge-ledger.ts
lib/server/google-drive-service.ts
```

并新增 Apps Script 源码：

```text
scripts/google-apps-script/r10-drive-bridge/Code.gs
scripts/google-apps-script/r10-drive-bridge/appsscript.json
```

实现边界：

- Apps Script → Vercel HMAC 签名；
- Google Drive push wake + 每分钟 polling fallback；
- server-bound `cat` identity；
- `life_drive_bridge_commands` durable ledger 防止回执丢失导致重复写；
- Drive 原图保存不压缩；Service Account 只读 `Originals/Meals`；
- Drive 原图压缩通道允许 25MB，仍输出现有 600px / WebP q70→55 / 120KB 目标；
- 每日完整 JSON → `Backups/Daily`，每月快照 → `Backups/Monthly`；
- Supabase 仍是唯一事实源。

详细可行性、Project Instructions、环境变量、激活步骤见 `docs/25-r10-chatgpt-project-drive-bridge.md`。

## 10. R10 尚未执行的 Production 动作

截至本状态记录，以下动作**尚未执行**：

- R10 Supabase migration 未应用 Production；
- Google Cloud Service Account 未创建/未分享 `Originals/Meals`；
- Apps Script Project 尚未实际部署为 Web App；
- R10 Vercel env 未配置；
- R10 Vercel Preview/Production 均未触发；
- ChatGPT Project 多窗口真实读写尚未端到端验收。

这些必须等代码 CI 通过后按 release checklist 激活。特别是 Vercel Production 仍需用户单次明确授权。

## 11. R10 Production 验收清单

上线时依次验证：

1. Bridge HMAC 非法请求拒绝；
2. snapshot 可刷新 `STATE_*`；
3. Project 新窗口查询药箱；
4. 新窗口新增一条用户明确授权的无害测试记录；
5. 修改 / 删除安全门；
6. 同 command ID 重放不会重复写；
7. 上传真实餐食原图到 Drive，不改变原图；
8. Vercel 下载原图并生成 Supabase 600px WebP；
9. 程序显示压缩图；
10. Daily backup 落 Drive；
11. Drive webhook 正常延迟；
12. 人为停掉 push 后 1 分钟 trigger 能补偿；
13. 新建第二、第三个 ChatGPT Project 聊天仍能读取同一真实程序。

## 12. 部署纪律

Git 自动部署必须继续保持：

```text
vercel.json -> git.deploymentEnabled: false
```

任何 Vercel Preview 或 Production deployment 都必须先取得用户明确许可。R10 开发、CI、Drive 文件夹/Sheet 准备和 Git 合并不等于 Production 发布。
