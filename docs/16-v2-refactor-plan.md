# V2 重构执行计划

本轮重构源于 Production 实机验收，不再把问题视为零散 UI 修补。

## 总原则

1. 先修账户、权限、导航和缓存边界，再改具体页面。
2. 能使用成熟项目/成熟库解决的问题，不重复造轮子；第三方实现必须经过现有 `App*` / 岛屿视觉适配层统一视觉。
3. 生活层继续坚持：记录，不评价；观察，不排名；数字是事实，不是成绩。
4. `/game` 旧游戏保持独立，不重新接入新版 Meal 明细。
5. Vercel Git 部署保持关闭；任何 Preview / Production 仍需单次明确授权。

## R1：账户与导航基础

### R1A ✅ 已完成

- 当前底部 Tab 再次点击自身不再触发同路由导航。
- 曾为通用 Auth 方案加入 profile/membership 基础；R1B 产品复核后确认本项目只有两位固定使用者，因此这些未使用表已通过 cleanup migration 删除。

### R1B ✅ 固定双账号方案

底层账号固定为 `cat / fish`，两个人继续共用旧程序同一个 `DATA_EDIT_PASSWORD`，不开放注册、不做邀请码、不允许第三个账号。

前端“我 / Ta”按当前登录身份动态解释：cat 登录时我=cat、Ta=fish；fish 登录时我=fish、Ta=cat。统一身份边界见 `docs/17-auth-and-pairing.md`。

已完成：

- `/login` 固定双账号登录；
- HMAC 签名 HttpOnly Cookie；
- `/api/auth/login` / `session` / `logout`；
- 根身份 Context 提供 `mePartnerKey / taPartnerKey`；
- mood / sleep / weight 新增写入执行 `OWN_RECORD_ONLY`；
- Supabase Auth 注册、bootstrap、邀请码、membership 临时方案全部撤销并清理。

仍需随领域重构继续收紧：

- Meal 创建/修改/删除按当前登录身份限制；
- 信箱发件人固定为当前登录身份；
- 活动记录明确创建人/参与人语义；
- 旧 game 同步继续保持独立稳定。

### R1C ✅ 导航持久化与 stale-while-revalidate 缓存基础

- `LifeIdentityProvider` 上移到根 `app/layout.tsx`，生活页切换不再反复重新确认身份。
- 新增 `lib/client/use-stale-query.ts`，提供稳定 query key、跨 remount 内存缓存、并发请求合并、TTL、后台 revalidate、force refresh 与局部 update/invalidate。
- 今日页使用 `life-day:YYYY-MM-DD` query key；返回首页时优先显示缓存，后台同步不再清空整块内容。
- R2-R5 页面在各自重做时继续接入同一缓存边界。
- 详细说明见 `docs/18-r1c-navigation-cache.md`。

本阶段没有手工伪造 npm lockfile 去强装 TanStack Query；原因和后续替换边界已写入 R1C 文档。

## R2：首页心情

- 首页只展示双方心情；
- “记录/修改”只能写当前登录账号；
- 另一方只读；
- 点击记录弹出独立毛绒情绪选择层；
- 移除字符模拟情绪图标；
- 睡眠编辑同步收紧为只编辑“我”。

## R3：饮食餐次

- 早餐/午餐/晚餐为固定槽，进入后不能改餐次；
- 加餐为 0..N；
- 新增加餐先选上午/下午/晚上；
- 已有加餐按具体记录编辑；
- Meal create/update/delete 接入当前账号所有权校验。

## R4：情绪日历

- 情绪直接散落在月历中；
- 无心情为空；
- 今天使用小太阳特殊状态；
- 有心情显示双方各自情绪图；
- 日期排布优先复用成熟 MIT 项目逻辑，视觉统一重做。

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
