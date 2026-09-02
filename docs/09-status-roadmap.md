# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细重构计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；R1C-R6 分阶段说明见 `docs/18-*` 至 `docs/23-*`。

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

## 3. Production 实机验收后的登录修复

Production 复查发现此前把“账号登录”和“同步密码”混在了一起，导致流程复杂且旧账号密码不能按正常登录方式使用。

修复目标：

```text
/login
账号
密码
登录
```

已调整：

- 删除登录页猫猫 / 鱼鱼账号选择卡；
- 登录 API 改为接收 `username + password`；
- `cat / fish` 作为固定账号名，并兼容 `猫猫 / 鱼鱼`；
- 账号密码与 sync gate 解耦；
- session HMAC 不再依赖同步密码；
- Today 不再显示“连接云端 / 同步密码”，401 直接回 `/login`；
- Life API 的 Supabase 配置检查不再要求 `DATA_EDIT_PASSWORD`。

账号密码配置优先级见 `docs/17-auth-and-pairing.md`。旧 `DATA_EDIT_PASSWORD` 仅保留为兼容兜底，不能再出现在新版生活系统的正常 UI 流程中。

## 4. 安全与数据边界

```text
Browser
  -> same-origin Next.js API
  -> fixed account signed session
  -> server-only domain service / RPC
  -> Supabase PostgreSQL
```

- service secret 永不进入浏览器；
- 业务数据继续以 Supabase 为准；
- 真实用户数据不提交公开 GitHub；
- 个人写操作继续强制 owner 校验。

## 5. 依赖提示

最近 CI 的 `npm ci` 仍报告 `9 vulnerabilities (1 low, 8 high)`。本轮没有使用 `npm audit fix --force` 做破坏性升级；应单独做 dependency-audit。

## 6. 部署状态

R1-R6 已于本日完成一次明确授权的 Production 部署，随后 Git 自动部署已经重新关闭。

当前 `vercel.json` 必须继续保持 `git.deploymentEnabled: false`。本次登录修复尚未获得新的部署授权，因此只能提交、测试、合并，不能触发 Vercel Preview / Production。
