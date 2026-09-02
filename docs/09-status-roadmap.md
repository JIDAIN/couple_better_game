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

当前登录目标：

```text
/login
账号
密码
登录
```

已完成：

- 删除登录页猫猫 / 鱼鱼账号选择卡；
- 登录 API 接收 `username + password`；
- Today 不再显示“连接云端 / 同步密码”，401 直接回 `/login`；
- session HMAC 与同步密码解耦；
- Production Supabase 新增 `life_fixed_accounts`；
- 两个真实固定账号已经写入 Production，并分别绑定 `cat / fish`；
- 密码只保存 bcrypt hash，不保存明文；
- server-only RPC `authenticate_fixed_life_account` 负责账号密码校验；
- RPC 只授予 `service_role` 调用，浏览器不能读取凭据表；
- 真实账号数据不写入公开 GitHub migration/seed。

详细边界见 `docs/17-auth-and-pairing.md`。

## 4. 安全与数据边界

```text
Browser
  -> same-origin Next.js API
  -> server-only Supabase credential RPC
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

当前 `vercel.json` 必须继续保持 `git.deploymentEnabled: false`。本次 Supabase 账号修复尚未获得新的部署授权，因此只能提交、测试、合并，不能触发 Vercel Preview / Production。

## 7. R7 实机视觉校准（代码完成，待 Preview 验收）

2026-09-03 再次对照 Production 手机截图与“岛屿生活 V2 · 方案 B”定稿后，确认 R6 只完成了页面级 visual adapter，实际组件仍存在移动端密度过低、卡片膨胀、系统 emoji 风格不统一等偏差。

R7 第一批已完成：

- 主内容宽度从平板尺度收回到移动端 `30rem`；
- 统一压缩卡片圆角、阴影、内边距与日历格高；
- 五项底部导航改为同一套线性 SVG 图标，移除系统 emoji；
- 首页标题改为“月日 + 星期”的生活化日期层级；
- Test 149/149、Lint（无 error）、Build 通过。

R7 第二批已完成：

- 按用户参考图将心情扩展为八种：心累 / 生气 / 兴奋 / 烦躁 / 心动 / 平静 / 伤心 / 开心；
- 使用统一的毛绒圆脸透明图标替换系统 emoji，并同步用于首页、选择器、月历和日期详情；
- 月历同一天的“我 / Ta”心情改为上下排列；
- 首页活动场景接入两位女孩透明角色图；
- 新增 `excited` 数据值与独立 migration，尚未执行 Production migration。

R7 页面级收口已完成：今日、饮食、餐食编辑、日历、日期详情、小窝、体重、小信箱、家庭药箱、游戏机和我的已统一移动端密度、返回操作、工具栏、卡片与空态。详细记录见 `docs/24-r7-mobile-ui-calibration.md`。

后续仍需在获得可用的手机视觉预览环境后，对首页内容构图、餐食真实数据长文本、各子页面弹层逐页校准。任何 Vercel Preview / Production 仍须单次明确授权。
