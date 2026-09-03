# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细重构计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；R1-R6 分阶段说明见 `docs/18-*` 至 `docs/23-*`；AI/MCP 边界见 `docs/11-ai-write-architecture.md`。

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
Browser
  -> same-origin Next.js API
  -> fixed account signed session
  -> server-only domain service / RPC
  -> Supabase PostgreSQL

ChatGPT
  -> OAuth 2.1 / PKCE
  -> /mcp
  -> domain adapter
  -> server-only canonical service / RPC
  -> Supabase PostgreSQL
```

- Supabase service secret 永不进入浏览器或 ChatGPT；
- MCP 使用独立 `LIFE_MCP_SIGNING_SECRET`；
- 个人 AI 写入由 OAuth identity 强制绑定当前 `cat / fish`，不相信模型传入的 owner；
- MCP 不暴露任意 SQL；
- 业务数据继续以 Supabase 为准；
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

R8 MCP 固定三个顶层工具：

```text
life_capabilities
life_query
life_write
```

当前能力：

- Medicine：查询；
- Meal：查询、新增、当前聊天照片上传；
- Weight：查询；
- Day / Mood / Sleep / Activity：查询；
- Mood / Sleep / Activity：受控确认写入；
- 后续新增 `cycle` 等 domain 时保持同一 Production `/mcp` 地址，不需要重新设计数据库通用入口。

餐食照片统一处理：

```text
原始图片 <= 10 MB
-> 自动方向修正 / 缩放
-> 最长边 600 px
-> WebP quality 70
-> 若 > 120 KB：65 -> 60 -> 55
-> 最低 quality 55
```

Web 手动上传与 ChatGPT 上传共用同一压缩器。

## 8. R8 测试与 Production 发布

PR #40 最终 CI：

```text
Test   ✅
Lint   ✅
Build  ✅
```

2026-09-03 在用户明确授权后执行 Production 发布。第一次发布尝试因 Vercel Production 安装阶段省略 devDependencies，缺少 `@tailwindcss/postcss` 而在 Build 阶段失败，未切换 Production alias；随后改用 `npm ci --include=dev` 重新构建。

最终 Production deployment：

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

Production MCP 地址固定为：

```text
https://couple-better-game.vercel.app/mcp
```

Git 自动部署仍必须保持关闭：

```text
vercel.json -> git.deploymentEnabled: false
```

今后任何 Vercel Preview 或 Production 部署仍须再次取得用户明确授权。
