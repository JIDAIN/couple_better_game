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

R1 账户 / 权限 / 导航 / 缓存                   ✅
R2 首页心情 / 睡眠                             ✅
R3 饮食餐次 / 多加餐 / Meal 写权限              ✅
R4 情绪月历                                   ✅
R5 小窝 / 我的职责重分                         ✅
R6 全站视觉还原                               ✅
```

旧“变美变瘦大作战”继续保持在 `/game`，只从「小窝 → 游戏机」进入；旧游戏不展示新版 Meal 明细，旧金币/宝石/兑换/结算边界未纳入本轮生活系统视觉重构。

## 2. R1-R6 最终结果

### R1：账户、权限、导航、缓存
- 固定 `cat / fish` 两个账号，共享旧 `DATA_EDIT_PASSWORD`。
- HMAC 签名 HttpOnly Cookie；前端“我 / Ta”相对当前登录身份动态解释。
- 当前 Tab 重复点击不再触发同路由导航。
- 根 `LifeIdentityProvider` 持久化身份上下文。
- stale-while-revalidate 查询缓存用于今日、饮食、日历等页面，返回页面优先显示缓存并后台刷新。

### R2：首页心情 / 睡眠
- 心情只允许当前登录者修改自己的记录，Ta 只读。
- 心情使用独立 bottom sheet，不再使用 ASCII 字符脸。
- 睡眠 UI 只编辑“我”的入睡 / 起床，Ta 只读。

### R3：饮食
- 早餐 / 午餐 / 晚餐固定槽，编辑器不能改成其他餐次。
- 加餐支持 `0..N`；新增时先选上午 / 下午 / 晚上。
- 每次加餐按独立 `mealId` 编辑。
- Meal create/update/delete/photo write 均增加当前 session + meal owner 服务端校验。
- Ta 饮食只读。
- 保存后只失效对应饮食 query，不再 `router.refresh()` 整页刷新。

### R4：日历
- 无心情日期下方留空。
- 今天显示小太阳特殊状态。
- 一人有心情显示一枚图，两人都有显示两枚轻微错位图。
- 显示顺序按当前 `mePartnerKey / taPartnerKey`。
- 月历使用缓存，布局模式参考成熟 MIT 情绪日历项目思路，视觉全部使用本项目适配层。

### R5：小窝 / 我的
- 小窝只承担共同生活内容：体重 / 小信箱 / 家庭药箱 / 游戏机。
- 我的只承担当前账号、同步、数据边界、设置和退出。
- 删除“我的”里重复的小窝/日历/游戏入口说明。
- 小信箱新信固定为当前登录者 `我 -> Ta`；收到的只读；自己寄出的可编辑/删除。
- Mailbox POST/PUT/DELETE 增加 sender ownership 服务端校验。

### R6：视觉
- 统一采用“岛屿生活视觉语言 V2 · 方案B”。
- 新增统一页面级 visual adapter，减少标准 SaaS 卡片堆叠。
- 统一背景、标题、底部导航、弹层、surface 材质。
- 日历改为更轻的纸质稀疏月历。
- 小窝改为房间场景 + 2×2 四入口。
- 我的改为账号 Hero + 设置/同步列表。
- 数据密集页保持克制；Legacy Game 不随 R6 改视觉。

## 3. 最终统一测试与修复

PR #35 首轮统一 CI：

```text
Test   ✅
Build  ✅
Lint   ❌
```

首轮 Lint 失败原因：

1. `TodayLifePage.tsx` 在 effect 内同步 `setState` 处理 query error；
2. `use-stale-query.ts` 在 effect 内同步把缓存写回 React state。

修复：

- Today 页改为从 `query.error` 派生登录/错误显示状态，不再为了 query error 额外 effect setState；
- stale query 的 key 切换同步改为 microtask 中恢复缓存并后台 refresh，避免 effect 同步级联渲染。

修复后的统一 CI run `33656830449`：

```text
Test   ✅
Lint   ✅
Build  ✅
```

因此 R1-R6 代码级统一验收已通过。

### 依赖安装提示

CI 的 `npm ci` 仍报告 npm audit 摘要：`9 vulnerabilities (1 low, 8 high)`。这不是本次 Test/Lint/Build 的失败项，也没有在本轮中用 `npm audit fix --force` 自动升级依赖，以避免未经审查的破坏性依赖变更。后续如处理，应单独做 dependency-audit PR，逐项确认受影响包和实际可达性。

## 4. 数据与安全边界

```text
Browser
  -> same-origin Next.js API
  -> fixed account signed session
  -> server-only domain service / RPC
  -> Supabase PostgreSQL
```

- service secret 永不进入浏览器；
- 业务数据继续以 Supabase 为准；
- DDL 只新增 migration，不修改已执行 migration；
- 真实用户数据不提交公开 GitHub。

## 5. 部署状态

`vercel.json` 继续保持 `git.deploymentEnabled: false`。

本轮 R1C-R6 **没有执行任何 Vercel Preview 或 Production 部署**。下一次 Preview / Production 必须重新取得用户针对该次部署的明确授权。
