# V2 重构执行计划

本轮重构源于 Production 实机验收，不再把问题视为零散 UI 修补。

## 总原则

1. 先修账户、权限、导航和缓存边界，再改具体页面。
2. 能使用成熟项目/成熟库解决的问题，不重复造轮子；第三方实现必须经过现有 `App*` / 岛屿视觉适配层统一视觉。
3. 生活层继续坚持：记录，不评价；观察，不排名；数字是事实，不是成绩。
4. `/game` 旧游戏保持独立，不重新接入新版 Meal 明细。
5. Vercel Git 部署保持关闭；任何 Preview / Production 仍需单次明确授权。

## R1：账户与导航基础 ✅

### R1A ✅
- 当前底部 Tab 再次点击自身不触发同路由导航。

### R1B ✅
- 底层账号固定 `cat / fish`，共享旧 `DATA_EDIT_PASSWORD`。
- 前端“我 / Ta”相对当前登录身份动态解释。
- HMAC 签名 HttpOnly Cookie；不开放注册、邀请码或第三账号。
- 详细说明见 `docs/17-auth-and-pairing.md`。

### R1C ✅
- 根 layout 持久 `LifeIdentityProvider`。
- 新增 stale-while-revalidate query cache。
- 今日页优先显示缓存、后台同步。
- 详细说明见 `docs/18-r1c-navigation-cache.md`。

## R2：首页心情 / 睡眠 ✅

- 心情只编辑当前 `mePartnerKey`；Ta 只读；
- 独立 bottom sheet 选择心情；
- 删除 ASCII 字符脸；
- 睡眠只编辑“我”的入睡 / 起床时间；
- 详细说明见 `docs/19-r2-today-mood-sleep.md`。

## R3：饮食餐次与多加餐 ✅

已完成：

- 早餐 / 午餐 / 晚餐改为固定槽，入口决定 mealType，编辑页不再允许改餐次；
- 加餐改为 `0..N` 独立记录；
- “新增加餐”先选上午 / 下午 / 晚上，再进入统一餐食编辑；
- 每一条加餐按 `mealId` 独立编辑；
- Ta 饮食只读；
- Meal create/update/delete 与 photo write 全部按服务端 meal owner + 当前 session 校验；
- 饮食页接入 `meals:{partnerKey}:{date}` cache，保存后只 invalidate 对应查询，不再 `router.refresh()`；
- 历史同餐次重复数据不自动删除，只提示整理；
- 详细说明见 `docs/20-r3-meal-model.md`。

## R4：情绪日历 ▶ 下一阶段

- 情绪直接散落在月历中；
- 无心情为空；
- 今天使用小太阳特殊状态；
- 有心情显示双方各自情绪图；
- 日期排布复用成熟 calendar grid 思路，视觉统一重做；
- 月历接入 R1C cache。

## R5：小窝 / 我的职责重分

- 小窝：两人共同拥有的内容（体重、信箱、药箱、游戏机）；
- 我的：当前账号、同步状态、数据管理、设置、退出登录；
- 删除重复产品说明；
- 信箱 sender 固定为当前登录身份。

## R6：全站视觉还原

- 以“岛屿生活视觉语言 V2 · 方案B”为验收基线；
- 减少标准 SaaS 卡片堆叠；
- 场景页加强插画和空间构图；
- 第三方库只复用逻辑/结构，统一通过视觉适配层。

## 最终统一验收

R6 与文档完成后统一执行 Test / Lint / Build；发现问题先修复，再重新执行，并在状态文档记录最终结果。

## 部署约束

`vercel.json` 默认保持 `git.deploymentEnabled: false`。任何 Preview / Production 部署必须再次获得用户明确授权。
