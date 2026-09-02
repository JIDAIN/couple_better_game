# 当前状态与 Roadmap

**状态日期：2026-09-02**

这份文件是“现在做到哪一步、下一步做什么”的主状态页。详细重构计划见 `docs/16-v2-refactor-plan.md`，账户与配对安全边界见 `docs/17-auth-and-pairing.md`。

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

旧“变美变瘦大作战”保持在 `/game`，只从「小窝 → 游戏机」进入；旧游戏不再展示新版 Meal 明细，金币、宝石、兑换、钱包和结算规则保持独立。

## 2. Production 实机验收后的重构

2026-09-02 Production 手机实机验收确认：现有 V2 功能虽已贯通，但账户隔离、页面缓存、心情交互、加餐模型、情绪日历以及视觉还原度都需要系统性重构，因此后续不再继续堆叠零散页面功能。

执行顺序：

```text
R1 账户 / 权限 / 导航 / 缓存
R2 首页心情
R3 饮食餐次与多加餐
R4 情绪月历
R5 小窝 / 我的职责重分
R6 全站视觉还原
```

## 3. R1 当前状态

### R1A ✅

- `life_user_profiles`
- `couple_space_members`
- Supabase Auth 用户到 `cat / fish` 的真实成员映射
- 每空间每身份唯一
- RLS 基础
- 当前底部 Tab 再次点击不再触发同路由导航

### R1B ✅ 主链路完成

- `/login` 注册 / 登录。
- Supabase Auth 负责密码验证、token 发行与刷新。
- access / refresh token 使用 HttpOnly Cookie。
- `/me` 变为账号、双人绑定与同步状态页。
- 第一个真实账号可使用旧同步密码执行一次性迁移绑定。
- 第二个账号只能通过 24 小时单次邀请码加入。
- 邀请码数据库只存 SHA-256 摘要。
- Life API 优先使用 Auth user + membership；旧 cloud-session 暂时作为迁移兼容。
- mood / sleep / weight 新增写入已开始强制“只能写自己”。

生产库当前没有人为创建假 Auth 用户；真实账号必须由两位使用者自己注册。

### R1B 后续收紧项

```text
Meal create/update/delete -> 当前账号归属
Mailbox sender            -> 当前账号身份
Activity ownership        -> 明确创建人与参与人
双账号迁移完成            -> 删除旧 cloud-session
```

### R1C 下一步

使用成熟缓存方案，优先 **TanStack Query**：

- `LifeAppShell` 持久 query client；
- 今日、饮食、日历、小窝使用稳定 query key；
- mutation 后局部更新/失效；
- 页面切换优先展示缓存，后台 revalidate；
- 解决实机中切 Tab / 回首页出现明显 loading 闪烁的问题。

## 4. 后续页面重构要求

### R2 心情

- 首页只展示双方状态；
- 记录按钮只编辑当前账号；
- Ta 只读；
- 弹出独立毛绒情绪选择层；
- 删除文字字符模拟脸。

### R3 饮食

- 早餐 / 午餐 / 晚餐固定槽，进入后不能改餐次；
- 加餐为 0..N；
- 新增加餐先选上午 / 下午 / 晚上；
- 每条加餐独立编辑。

### R4 日历

- 无心情留空；
- 今天有单独小太阳视觉；
- 有记录时情绪图直接出现在月历中；
- 日期布局 / mood mapping 优先复用成熟 MIT 项目逻辑，再统一视觉。

### R5 小窝 / 我的

```text
小窝 = 两人共同内容
体重 / 小信箱 / 家庭药箱 / 游戏机

我的 = 当前账户
登录身份 / Ta 绑定 / 同步状态 / 数据管理 / 设置 / 退出
```

### R6 视觉

以 `docs/12-island-life-design-system.md` 为唯一视觉基线，减少标准 SaaS 卡片堆叠。成熟 GitHub 项目和组件库优先复用逻辑/结构，但必须通过 App* / 岛屿视觉层适配。

## 5. 数据与安全边界

目标架构：

```text
Browser
  -> same-origin Next.js API
  -> Supabase Auth identity + couple-space membership
  -> server-only domain service / RPC
  -> Supabase PostgreSQL
```

- service secret 永不进入浏览器；
- 业务数据继续以 Supabase 为准；
- DDL 只新增 migration，不修改已执行 migration；
- 真实家庭药箱数据等用户数据不提交公开 GitHub；
- Web / AI / import 最终复用同一领域事实与写入服务。

## 6. 部署状态

`vercel.json` 默认必须保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

此前一次 Production 部署已获得单次授权并完成，该授权已经结束。当前重构代码不得自动触发 Preview / Production；任何下一次部署必须再次获得明确授权。
