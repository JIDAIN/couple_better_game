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
- 无心情日期下方完全留空；
- 今天使用小太阳特殊标识；
- 一人有记录显示一枚情绪图，双方都有显示两枚轻微错位的情绪图；
- 显示顺序按当前 `mePartnerKey / taPartnerKey`；
- 月历接入 `life-month:{YYYY-MM}` cache；
- 日期排布和 mood-under-date 模式参考 MIT `GitHub-Xzhi/obsidian-mood-calendar`，只复用产品/布局思路，不复制视觉资产或插件代码；
- 详见 `docs/21-r4-mood-calendar.md`。

## R5：小窝 / 我的职责重分 ▶ 下一阶段
- 小窝：两人共同拥有的内容（体重、信箱、药箱、游戏机）。
- 我的：当前账号、同步状态、数据管理、设置、退出登录。
- 删除重复产品说明。
- 信箱 sender 固定为当前登录身份；收到的信只读，自己寄出的信才可编辑/删除。

## R6：全站视觉还原
- 以“岛屿生活视觉语言 V2 · 方案B”为验收基线。
- 减少标准 SaaS 卡片堆叠。
- 场景页加强插画和空间构图；数据密集页保持克制。
- 第三方库只复用逻辑/结构，统一通过视觉适配层。

## 最终统一验收
R6 与文档完成后统一执行 Test / Lint / Build；发现问题先修复，再重新执行，并回写状态文档。

## 部署约束
`vercel.json` 默认保持 `git.deploymentEnabled: false`。任何 Preview / Production 必须再次获得明确授权。
