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
R10 Google Drive Bridge 基础                      ✅ 已合并
R10 Harbor Cat / Harbor Fish 双入口              ✅ 代码/Drive/CI 完成，PR #43 待合并
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

Harbor Cat / Harbor Fish（R10 主路径）
  -> Google Drive / Sheets App
  -> actor-specific Bridge Sheet
  -> actor-specific Apps Script signed worker
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
- Harbor Cat 与 Harbor Fish 使用独立 HMAC / watch / wake credential；
- `x-life-bridge-id` 只能选择对应 secret，Cat secret 不能签成 Fish，反之亦然；
- AI 不相信模型提供的个人 owner；
- 原图 fileId 还要再次校验必须位于对应 actor 的 Drive 子目录；
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

PR #41 最终 CI：

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

## 9. R10 双 Harbor ChatGPT Project × Google Drive Bridge

用户已实际创建两个 ChatGPT Project：

```text
Harbor Cat
Harbor Fish
```

它们是同一个生活空间的两个 AI 入口，不是两套程序或两套数据。

固定语义：

```text
Harbor Cat:  我=cat,  Ta=fish
Harbor Fish: 我=fish, Ta=cat
```

Google Drive 已调整为：

```text
Couple Better Game/
├─ AI-Bridge/
│  ├─ Cat/Couple Better Game AI Bridge - Cat
│  └─ Fish/Couple Better Game AI Bridge - Fish
├─ Originals/Meals/
│  ├─ Cat/
│  └─ Fish/
├─ Backups/Daily/
├─ Backups/Monthly/
└─ Trash/
```

两张 Bridge Sheet 都包含：

```text
README / META / COMMANDS / RECEIPTS / STATE_* / ASSETS
```

且都已升级为：

```text
schema_version = r10-v2
```

备份不复制两份：

```text
Harbor Cat  = backup leader
Harbor Fish = backup follower
```

所以 Daily/Monthly 的灾备单位始终是整个 Couple Better Game 家庭空间。

## 10. R10 双入口安全实现

服务端使用：

```text
x-life-bridge-id: cat | fish
```

并为两边分别配置：

```text
BRIDGE_SECRET
WATCH_TOKEN
APPS_SCRIPT_URL
APPS_SCRIPT_WAKE_SECRET
ORIGINALS_MEALS_FOLDER_ID
```

Apps Script 代码只维护一份，但通过 Script Properties 分别绑定 Cat/Fish Sheet。

命令账本主键已调整为：

```text
(actor, command_id)
```

原图也强制按 actor 目录隔离：

```text
Cat command  -> Originals/Meals/Cat only
Fish command -> Originals/Meals/Fish only
```

Drive 原图仍不压缩；进入程序的展示图仍使用 600px / WebP q70→55 / 120KB 目标。

## 11. R10 CI 与 Git 状态

基础 R10 已通过 CI 并合并 main：

```text
PR #42
merge: 8b3b1832d0901ea10efd5e2a9f8bc07ab06ee4f5
```

双 Harbor 收口：

```text
PR #43
CI #232
Test   ✅
Lint   ✅
Build  ✅
```

本批仍未触发 Vercel Preview/Production。

## 12. R10 尚未执行的 Production 动作

以下动作**尚未执行**：

- R10 Supabase migration 未应用 Production；
- Google Cloud Service Account 未正式创建/授权两个 actor 原图目录；
- Cat/Fish Apps Script Project 尚未实际部署为 Web App；
- Cat/Fish Production env secret 尚未配置；
- R10 Vercel Preview/Production 均未触发；
- Harbor Cat / Harbor Fish 多窗口真实读写尚未端到端验收；
- 旧 Supabase 压缩照片尚未归档到 `Backups/Legacy-Photos`。

这些统一放到取得 Vercel 部署许可后的 Production 激活阶段。

## 13. R10 Production 验收清单

上线时依次验证：

1. Cat/Fish HMAC 交叉冒充失败；
2. Cat/Fish snapshot 都能刷新各自 `STATE_*`；
3. Harbor Cat 新窗口查询共享药箱；
4. Harbor Fish 新窗口查询同一药箱；
5. Cat 新增自己的无害测试记录；
6. Fish 新增自己的无害测试记录；
7. Cat 冒充 Fish 写个人记录失败；
8. Fish 冒充 Cat 写个人记录失败；
9. 同 actor command ID 重放不会重复写；
10. Cat/Fish 原图只能使用自己的 Drive 子目录；
11. 原图保持不变，Supabase 生成 600px WebP；
12. 程序显示压缩图；
13. 两个 Drive watch 都能唤醒正确 worker；
14. 人为停掉 push 后一分钟 trigger 能补偿；
15. 只有 Cat backup leader 写 Daily/Monthly；
16. Daily backup 可完成恢复演练；
17. Harbor Cat / Harbor Fish 各自新建多个聊天仍保持身份不串线。

## 14. Project 人格与 Skill

两个 Project 的底层数据 skill / 安全规则必须一致，但 AI 人格允许完全独立：

```text
Harbor Cat  -> 独立 AI name / style /称呼 /习惯
Harbor Fish -> 独立 AI name / style /称呼 /习惯
```

共享 skill 负责数据读写、照片、药箱、小信箱、删除安全和未来 domain 扩展；Project-local personality 只改变交互风格，不能绕过权限。

具体 Project Instructions / skill playbook 在 Production 激活前最后配置，不把任何生产 secret 写进 Project。

## 15. 部署纪律

Git 自动部署必须继续保持：

```text
vercel.json -> git.deploymentEnabled: false
```

任何 Vercel Preview 或 Production deployment 都必须先取得用户明确许可。R10 开发、CI、Drive 文件夹/Sheet 准备和 Git 合并不等于 Production 发布。
