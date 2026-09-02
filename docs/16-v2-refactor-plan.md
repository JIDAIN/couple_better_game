# V2 重构执行计划

本轮重构源于 Production 实机验收，不再把问题视为零散 UI 修补。

## 总原则
1. 先修账户、权限、导航和缓存边界，再改具体页面。
2. 成熟项目/成熟库优先；第三方实现必须经过 `App*` / 岛屿视觉适配层。
3. 生活层：记录，不评价；观察，不排名；数字是事实，不是成绩。
4. `/game` 旧游戏保持独立。
5. Vercel Git 部署保持关闭；任何 Preview / Production 仍需单次明确授权。

## R1：账户、权限、导航、缓存 ✅
- R1A：当前 Tab 重复点击不再同路由导航。
- R1B：固定 `cat/fish` 双账号、共享旧密码、相对“我/Ta”、HMAC HttpOnly Cookie。
- R1C：根身份 Context + stale-while-revalidate 查询缓存；今日页优先展示缓存。
- 详见 `docs/17-auth-and-pairing.md`、`docs/18-r1c-navigation-cache.md`。

## R2：首页心情 / 睡眠 ✅
- 只编辑当前 `mePartnerKey`；Ta 只读。
- 心情使用独立 bottom sheet；删除 ASCII 字符脸。
- 睡眠只编辑“我”的入睡 / 起床。
- 详见 `docs/19-r2-today-mood-sleep.md`。

## R3：饮食餐次与多加餐 ✅
- 早餐 / 午餐 / 晚餐固定槽，编辑页不再改餐次。
- 加餐 `0..N`，先选上午 / 下午 / 晚上，再进入统一编辑页。
- 每次加餐按 `mealId` 独立编辑。
- Meal create/update/delete/photo write 由服务端 owner + 当前 session 校验。
- 饮食接入 `meals:{partnerKey}:{date}` cache。
- 详见 `docs/20-r3-meal-model.md`。

## R4：情绪日历 ✅
- 无心情日期下方完全留空；今天使用小太阳。
- 一人有记录显示一枚情绪图，双方都有显示两枚轻微错位图标。
- 显示顺序按 `mePartnerKey / taPartnerKey`。
- 月历接入 `life-month:{YYYY-MM}` cache。
- 产品模式参考 MIT `GitHub-Xzhi/obsidian-mood-calendar`，不复制其视觉资产或插件代码。
- 详见 `docs/21-r4-mood-calendar.md`。

## R5：小窝 / 我的职责重分 ✅
- 小窝只负责共同生活四入口：体重 / 小信箱 / 家庭药箱 / 游戏机。
- 我的只负责当前账号、相对身份、同步、写入边界、数据管理与退出。
- 删除“我的”里重复的小窝/日历/游戏快捷入口。
- 小信箱新信固定 `我 -> Ta`；收到的只读；自己寄出的可编辑/删除。
- Mailbox POST/PUT/DELETE 增加服务端 sender ownership 校验。
- 详见 `docs/22-r5-nest-me-boundary.md`。

## R6：全站视觉还原 ✅
- 以“岛屿生活视觉语言 V2 · 方案B”为基线。
- 新增 `app/island-life-refactor.css` 统一页面级 visual adapter。
- 统一背景、标题、底部导航、sheet、surface 材质。
- 日历从 SaaS 日期卡改成稀疏纸质月历。
- 小窝使用房间场景 + 2×2 四入口。
- 我的使用账号 Hero + 设置列表。
- 数据密集页保持克制；Legacy Game 不改视觉/机制。
- 更新 `docs/12-island-life-design-system.md`；详见 `docs/23-r6-visual-polish.md`。

## 最终统一验收 ✅

按用户要求，在 R6 与分阶段文档全部完成后统一执行 Test / Lint / Build。

首轮：

```text
Test   ✅
Build  ✅
Lint   ❌
```

Lint 定位到两处 React effect 同步 setState：`TodayLifePage.tsx` 与 `use-stale-query.ts`。已分别改为 query error 派生状态，以及 microtask 恢复缓存/后台 refresh。

修复后 CI run `33656830449`：

```text
Test   ✅
Lint   ✅
Build  ✅
```

完整修复与已知 npm audit 提示记录见 `docs/09-status-roadmap.md`。

## 本轮结论

R1-R6 重构及代码级统一验证已完成。下一次产品验收应在获得单次 Vercel 部署授权后，通过真实移动端 / 浏览器检查视觉、导航、空态、长文本、真实数据与旧游戏回归。

## 部署约束
`vercel.json` 默认保持 `git.deploymentEnabled: false`。任何 Preview / Production 必须再次获得明确授权。
