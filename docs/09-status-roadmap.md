# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细重构计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；导航缓存见 `docs/18-r1c-navigation-cache.md`。

## 1. 已完成的 V2 主功能

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
```

旧“变美变瘦大作战”保持在 `/game`，只从「小窝 → 游戏机」进入；旧游戏不再展示新版 Meal 明细。

## 2. Production 实机验收后的重构

```text
R1 账户 / 权限 / 导航 / 缓存        ✅ 基础完成
R2 首页心情                         ▶ 下一阶段
R3 饮食餐次与多加餐
R4 情绪月历
R5 小窝 / 我的职责重分
R6 全站视觉还原
```

## 3. R1 当前状态

### R1A ✅ 导航
- 当前底部 Tab 再次点击自身不触发同路由导航。

### R1B ✅ 固定双账号与相对“我 / Ta”
- 底层账号固定 `cat / fish`；共享旧 `DATA_EDIT_PASSWORD`。
- 登录后签发 HMAC 签名 HttpOnly 身份 Cookie。
- 前端 `我 / Ta` 相对当前会话动态解释。
- 不开放注册、邮箱验证、邀请码或第三账号。
- mood / sleep / weight 新增写入强制 `OWN_RECORD_ONLY`。

### R1C ✅ 持久身份与缓存基础
- `LifeIdentityProvider` 上移根 layout，路由切换不重新创建身份边界。
- 新增 stale-while-revalidate query cache，支持稳定 query key、TTL、并发合并、后台刷新、force refresh、局部 update/invalidate。
- 今日页已接入 `life-day:YYYY-MM-DD`，返回首页优先显示缓存，不再先清空为整块 loading。
- 饮食、日历、小窝资源在 R3-R5 重构时按同一模式接入。

## 4. 后续页面重构

### R2 心情 / 睡眠
- 只允许当前登录账号记录/修改自己的心情；
- 另一方只读；
- 弹出独立情绪选择层；
- 删除字符模拟脸；
- 睡眠 UI 也从双人编辑改为“我可编辑、Ta 只读”。

### R3 饮食
- 早餐 / 午餐 / 晚餐固定槽；
- 加餐为 0..N；
- 新增加餐先选上午 / 下午 / 晚上；
- 每条加餐独立编辑；
- Meal create/update/delete 接入当前账号所有权校验。

### R4 日历
- 无心情留空；
- 今天使用小太阳特殊视觉；
- 有记录时情绪图直接出现在月历中；
- 日期布局优先复用成熟 MIT 项目逻辑后统一视觉。

### R5 小窝 / 我的

```text
小窝 = 体重 / 小信箱 / 家庭药箱 / 游戏机
我的 = 当前账号 / 同步 / 数据管理 / 设置 / 退出
```

并把小信箱 sender 固定为当前登录身份。

### R6 视觉

以 `docs/12-island-life-design-system.md` 为唯一视觉基线；成熟 GitHub 项目和组件库优先复用逻辑/结构，但必须经过 App* / 岛屿视觉适配。

## 5. 最终统一验收

R6 完成且文档更新后统一运行 Test / Lint / Build；发现问题先修复，再重新执行并把结果回写文档。

## 6. 数据与安全边界

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

## 7. 部署状态

`vercel.json` 默认保持 `git.deploymentEnabled: false`。此前 Production 单次授权已经结束；下一次 Preview / Production 必须重新取得明确授权。
