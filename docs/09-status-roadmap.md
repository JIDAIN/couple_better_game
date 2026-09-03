# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细重构计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；R1-R6 分阶段说明见 `docs/18-*` 至 `docs/23-*`；AI/MCP/内置 Agent 边界见 `docs/11-ai-write-architecture.md`。

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
R9 Production 实机                              ⏳ 待单次授权
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

Browser /ai
  -> fixed account signed session
  -> server-only AI Gateway call
  -> life_query / life_mutate registry
  -> canonical domain service / RPC
  -> Supabase PostgreSQL / Storage

External MCP client（可选）
  -> OAuth 2.1 / PKCE
  -> /mcp
  -> domain adapter
  -> canonical domain service / RPC
  -> Supabase PostgreSQL
```

- Supabase service secret 永不进入浏览器、普通聊天或模型上下文；
- AI Gateway credential 只存在于 Vercel server runtime；
- MCP 使用独立 `LIFE_MCP_SIGNING_SECRET`；
- 个人 AI 写入在服务端强制绑定当前 `cat / fish`，不相信模型传入的 owner；
- 不暴露任意 SQL、任意 Supabase 请求或任意 URL 下载工具；
- 业务数据继续以 Supabase 为事实源；
- 真实用户数据与生产 secret 不提交 GitHub。

## 5. 依赖提示

当前 lockfile 的 `npm ci` 仍报告 `9 vulnerabilities (1 low, 8 high)`。本轮没有使用 `npm audit fix --force` 做破坏性升级；依赖安全升级应作为独立 dependency-audit 处理。

## 6. R7 实机视觉校准

R7 已完成：

- 主内容宽度收回移动端 `30rem`；
- 统一卡片圆角、阴影、内边距、日历密度；
- 五项底部导航使用统一线性 SVG；
- 八种心情接入统一毛绒圆脸图标；
- 月历双人心情上下排列；
- 首页活动场景接入双人角色图；
- Today、饮食、餐食编辑、日历、日期详情、小窝、体重、小信箱、家庭药箱、游戏机、我的完成页面级收口；
- 账号切换清理旧身份缓存，登录并行预热常用生活数据；
- 小信箱增加月份归档和日期轴信纸列表。

`excited` migration 已在 Production 执行并验证。详细记录见 `docs/24-r7-mobile-ui-calibration.md`。

## 7. R8 数据管理与 MCP

R8 Production Supabase 已执行：

```text
20260903020502  r8_data_management_life_refinement
20260903023150  r8_mcp_redemption_rls
```

其中包括：

- 生活设置、周年日、目标体重、信纸元数据；
- transactional backup snapshot / export / restore / import；
- `life_mcp_code_redemptions` 授权码一次性兑换记录；
- MCP redemption 表启用 RLS，浏览器角色无权限。

PR #40 已合并到 `main`，合并 commit：

```text
6b904beb1f5ae6073ea4c5fa53be900e4042309f
```

R8 Production MCP 地址：

```text
https://couple-better-game.vercel.app/mcp
```

MCP/OAuth 服务端本身已上线并通过 discovery / 401 challenge 验证；但当前个人 ChatGPT 产品侧不提供所需的自定义 MCP 写入入口，因此 R9 不再把核心 AI 能力依赖于该客户端权限。

## 8. R8 测试与 Production 发布

PR #40 最终 CI：

```text
Test   ✅
Lint   ✅
Build  ✅
```

最终 R8 Production deployment：

```text
dpl_FvWJfrmtH1fcVie8UsXT4Ez871tD
READY
https://couple-better-game.vercel.app
```

线上协议检查：

- `/.well-known/oauth-protected-resource` -> 200；
- `/.well-known/oauth-protected-resource/mcp` -> 200；
- `/.well-known/oauth-authorization-server` -> 200；
- 未授权 `/mcp` -> 401，并返回正确 `WWW-Authenticate` / resource metadata；
- 上述路由部署后无 Vercel runtime error。

## 9. R9 程序内置 AI Agent

R9 改用“AI 在程序内部作为当前登录用户的自然语言操作层”，不依赖 ChatGPT Plus 是否开放 MCP/GPT Actions。

入口：

```text
/ai
/api/ai/chat
```

模型层：

```text
Vercel AI Gateway
默认模型：google/gemini-2.5-flash
可用 LIFE_AI_MODEL 替换
Production 优先使用 VERCEL_OIDC_TOKEN
```

内部稳定工具：

```text
life_capabilities
life_query
life_mutate
```

AI 当前可查询：

- 某日心情 / 睡眠 / 活动；
- 月度双人心情；
- 餐食与餐食明细；
- 体重历史；
- 家庭药箱；
- 小信箱；
- 周年日 / 目标体重；
- V2 完整生活数据导出；
- 旧 `/game` 完整同步快照。

AI 当前可像当前登录用户一样修改：

- Mood / Sleep：upsert；
- Activity：create / update / delete；
- Meal：create / update / delete + 当前图片；
- Weight：create / update / delete；
- Medicine：create / update / delete；
- Mailbox：create / update / delete；
- Settings：周年日 / 当前账号目标体重；
- Legacy `/game`：仅固定强确认短语后允许完整 replace。

权限边界：

- cat 登录后 AI 个人记录只能写 cat；fish 同理；
- 模型自己传入另一方 owner 会被服务端覆盖/拒绝；
- Meal / Weight 修改删除前再次核验 owner；
- 小信箱只能以当前账号寄出，也只能修改/删除当前账号自己发出的信；
- Medicine 延续家庭共享药箱规则；
- 删除要求用户当前消息明确表达删除；
- 旧游戏完整覆盖要求当前消息明确包含 `确认覆盖游戏数据`；
- 没有任意 SQL 或数据库管理员能力。

图片继续统一使用：

```text
最长边 600 px
WebP quality 70
>120 KB -> 65 -> 60 -> 55
最低 quality 55
```

用户可以在 `/ai` 上传餐食图片，AI 先视觉理解；若用户同时明确要求记录，同一张压缩图会保存到对应餐食记录。

## 10. R9 测试状态

PR #41：`R9: in-app AI agent with full life data access`。

最新 CI run #222：

```text
Test   ✅
Lint   ✅
Build  ✅
```

新增权限回归测试覆盖：

- 模型传 `fish` 也不能让 cat 登录者把个人体重写到 fish；
- 没有明确删除意图时拒绝 delete；
- 不能修改 Ta 发出的信；
- 旧 `/game` 全量覆盖必须出现固定确认短语。

R9 代码测试通过，但截至本状态记录**尚未发布 Production**。因此目前只能确认代码/构建闭环，不能声称线上 AI Gateway、真实登录态查询和真实写回已完成实机验收。

## 11. 部署纪律

Git 自动部署必须继续保持关闭：

```text
vercel.json -> git.deploymentEnabled: false
```

R9 Production 发布必须再次取得用户的单次明确授权。发布后还需执行：

1. `/ai` Production 页面加载检查；
2. 未登录 `/api/ai/chat` -> 401；
3. 登录后 AI Gateway 首次真实对话；
4. 只读查询药箱/饮食等真实数据；
5. 用户明确授权的一次非破坏性写入实测；
6. 图片识别 + 餐食照片绑定实测；
7. Vercel runtime error/log 检查。
