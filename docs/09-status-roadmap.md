# 当前状态与 Roadmap

**状态日期：2026-09-04**

详细视觉规范见 `docs/12-island-life-design-system.md`；R8.1 见 `docs/30-r8-ui-closeout.md`；R8.2 见 `docs/31-r8-2-ui-calibration.md`；R8.3 见 `docs/32-r8-3-visual-polish.md`；R8.4 见 `docs/33-r8-4-resilient-navigation-and-readiness.md`；R10 Drive Bridge 见 `docs/25-*` 至 `docs/29-*`。

## 1. 主功能状态

```text
V2-P0  新旧系统边界 /game                    ✅
V2-P1  心情 / 睡眠 / 活动 facts + API         ✅
V2-UI  岛屿生活视觉语言 + App* 基础            ✅
V2-P2  今日首页                               ✅
V2-P3  饮食 + 编辑 + 照片                     ✅
V2-P4  月历 + 日期详情                         ✅
V2-P5  小窝 + 体重                             ✅
V2-P6  家庭药箱                                ✅
V2-P7  小信箱                                  ✅
V2-P8  游戏机列表 -> /game                     ✅
R1-R7  重构与移动端校准                         ✅
R8     数据管理 + MCP                          ✅
R8.1   第一轮视觉/交互收口                       ✅ Production
R8.2   Production 实机视觉二次校准               ✅ Production
R8.3   信息减法 + UI hotfix                     ✅ Production
R8.4   弱网缓存 + 持久导航 + App Shell            ✅ Production
R8.7   无阻塞启动 + 图片缓存 + 日历即时同步          ✅ Production
R8.8   缓存竞态收口 + 首页/饮食/日历无闪烁           ✅ Production
R9     程序内置 AI Agent                        ✅ 备用能力，不展示在“我的”
R10    双 Harbor + Worker Pairing 后端            ✅ Production
R10.1  Supabase -> PushPlus 微信调度后端           ✅ Production DB
R10.1  微信绑定/测试网页                         ⏳ 等待一次授权 Production 部署
R10.1  Cat/Fish Apps Script AI Workers           ⏳ 尚未激活
```

## 2. 固定身份与 Harbor

```text
cat 登录  -> 我=cat,  Ta=fish
fish 登录 -> 我=fish, Ta=cat

Harbor Cat  / 团子 -> authoritative actor = cat
Harbor Fish / 仔仔 -> authoritative actor = fish
```

AI 昵称只用于会话识别；服务端权限始终绑定 `cat / fish`。

## 3. R8.4 弱网与页面切换

Production 实机确认原 stale-while-revalidate 仍只有内存缓存，而且 `/api/auth/session` 临时失败会被误判为退出登录；底部导航也在每个页面 Shell 内重复挂载。

R8.4 已完成并上线：

- `stale-query` 增加 cat/fish 身份隔离的 `localStorage` 持久读缓存；
- `localStorage` 保存最近确认的 cat/fish 非授权 scope hint，使安装后的应用重新打开时能立刻恢复对应的本地读缓存；真实权限仍由服务端签名 Cookie 确认；
- 网络/5xx 失败不再自动变成“退出登录”，服务器明确 unauthenticated 才清身份；
- 网络恢复后自动重新确认 session 并后台刷新；
- 今日、月历、饮食、体重、药箱、信箱、设置均可在已有缓存时继续显示旧数据；
- 底部导航上移至 Root `PersistentLifeChrome`，主 tab 切换时不再反复卸载重建；
- Root 主动 prefetch 今日 / 饮食 / 日历 / 小窝 / 我的；
- 新增 `/life-sw.js`，缓存主要页面壳与静态资源；
- 页面弱网超过约 2.5 秒可回落已缓存 App Shell；
- Service Worker 明确不缓存 `/api/*`、MCP、OAuth 数据，Supabase 始终是事实源；
- 写操作仍要求真实网络和服务端权限，不伪装成离线写入。

PR #52：

```text
merge commit: 3232f834941431706d70a03deda4077978fe8b62
CI #274:
Test   ✅ 207/207
Lint   ✅
Build  ✅
```

## 4. R8.7-R8.8 无感加载与缓存一致性（已上线）

R8.4-R8.6 已有持久读缓存与月度 bundle，但 Production 实机仍能看到启动进度、餐食默认图切换到实拍图、心情写入后月历短暂显示旧值。R8.7 先移除人为启动 gate、统一 canonical 预热和图片版本缓存；Production 复查后又确认存在一个更深层竞态：早于写入启动的旧请求可能在更晚返回后把新缓存覆盖回旧数据。R8.8 针对这个竞态和剩余首屏闪烁完成最后收口。

当前已上线能力：

- 删除全屏启动 gate 及其 CSS，页面壳不再被 620ms/2.4s 人为阻塞；
- 最近确认身份的 scope hint 跨应用重开保留，浏览器绘制前恢复身份提示和持久读缓存；真实权限仍由签名 Cookie 决定；
- 启动首批预热只使用 Today/Food 的 canonical keys，月历、体重、药箱、信箱延后，降低首屏 RPC 争抢；
- 月度 bundle 直接生成 `life-month:*` 月历缓存；
- 心情/睡眠/活动写入 read-back 后同步更新 day、month、bundle 三层缓存；
- stale-query 增加 request revision barrier：旧 in-flight 响应不能覆盖 mutation 后的新缓存；invalidate 发生在飞行请求途中时会从 mutation 之后重新读取；
- 月度 bundle 尚在请求途中时发生 day/mood 写入，会显式使旧 bundle 快照失效，避免月历回滚；
- 餐食照片 URL 带 `updatedAt` 版本，响应为 `private, max-age=31536000, immutable`；
- 餐食编辑/删除直接更新当日列表缓存；
- 今日页首帧使用固定尺寸静态壳，不显示“第一次读取今天的记录”；
- 饮食页身份/数据恢复期间不显示“正在确认当前账号”，餐食记录未恢复时使用中性图片位，避免默认餐图再切实拍图；
- 日历直接首屏渲染月份网格，身份和心情只增量补齐，不再整页从加载态切换。

PR #58 最终 CI：

```text
Test   ✅ 221/221
Lint   ✅
Build  ✅ Next.js production build
```

Production 验收：

```text
/             200
/food         200
/calendar     200
首页首屏       无“第一次读取今天的记录”文字
饮食首屏       无“正在确认当前账号”文字
日历首屏       直接渲染 2026 年 9 月网格
runtime       部署后最近 30 分钟 error/fatal = 0
```

## 5. 当前 Vercel Production

```text
primary domain: https://couple-better-game.vercel.app
deployment: dpl_2WsHTaUJZYLht9J8mRZZQ4vjKLSf
status: READY
source commit: 0cffc3bf906a7a2bfdb8d878af3b9d544bed2eb1
release: R8.8
```

本轮 R10.1 尚未获得新的 Vercel Production 授权，因此网页/API 变更不会擅自上线。

`vercel.json` 当前保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

## 6. R10 AI 当前真实状态

代码/协议已经具备：

- Production `/mcp` 与 canonical `life_query / life_mutate`；
- Cat/Fish 独立 HMAC 固定身份；
- 个人数据写权限隔离；
- 共享药箱 / 设置；
- `(actor, command_id)` 幂等 ledger；
- Drive 原图身份目录隔离；
- 原图 -> 600px WebP -> Supabase Storage；
- Drive watch + 一分钟 fallback；
- Cat 单一家庭备份 leader。

截至 2026-09-04，OpenAI 对个人 Plus 仍未开放自定义 MCP 的完整写入能力，因此当前 Plus 的可执行兼容路径仍是 Harbor Drive Bridge。R10.1 已把微信提醒从该 Worker 移除，使 AI Worker 只承担 AI/Drive 工作。

Production 数据库实况仍为：

```text
cat  apps_script_url = empty / paired_at = null
fish apps_script_url = empty / paired_at = null
life_drive_bridge_commands = 0 条真实命令
```

因此 Harbor AI **后端已经准备好，但还不能称为真实可用**。下一步只剩两个 bound Apps Script Web App 的一次性人工激活，然后由系统自动 pairing，再做真实读写、照片、watch、fallback 和 backup 验收。

## 7. 微信提醒当前真实状态

Production DB 已完成 R10.1：

```text
daily reminder       21:15  enabled
anniversary reminder 09:15  enabled
offsets              [7,1,0]
cron                  */5 * * * * active
provider              Supabase http -> PushPlus -> WeChat
cat token             未配置
fish token            未配置
```

已验证：

- Supabase Vault 可用；
- `http` extension 可用；
- `pg_cron` 可用；
- `life-pushplus-reminders-v1` active；
- cron 已至少真实执行一次且状态 `succeeded`；
- 未配置 token 时 Cat/Fish 都安全 no-op；
- 不会因为没有 token 就生成假的 delivery reservation。

网页已经加入“我的 -> 微信提醒”卡片，可保存 / 替换 token、测试发送和解绑。token 只进入服务端并加密保存到 Vault，网页只能获取布尔状态。

目前唯一未完成的是：网页代码尚未获得本轮 Vercel Production 授权，因此还不能在生产站绑定 token；也就尚未做 Cat/Fish 两条真实微信测试。

## 8. 达到“日常实用”的最后验收

AI：

```text
1. 创建并发布 Cat / Fish Apps Script Web App
2. 分别完成 setupR10Pairing()（内部调用 setupR10Triggers()）
3. Harbor Cat / Fish 自动回填 apps_script_url
4. 两边真实 query / mutate
5. 跨身份写入拒绝
6. 餐食原图完整链路
7. Drive watch 延迟实测
8. 1 分钟 fallback 实测
9. Cat Daily backup 实际生成
10. 至少一次恢复演练
```

微信：

```text
1. 获得一次明确 Vercel Production 授权并上线“我的 -> 微信提醒”
2. Cat 登录后绑定 cat PushPlus token，发送真实测试微信
3. Fish 登录后绑定 fish PushPlus token，发送真实测试微信
4. 已有当天记录时不发送 daily reminder
5. 同 dedupe key 不重复发送
6. 模拟一次失败后重试成功
```

这些验收通过后，当前架构对两个人的私人日常使用已经足够，不需要再增加数据库、消息队列或额外付费基础设施。长期最可能的容量瓶颈仍是 Google Drive 原始照片空间。

## 9. 当前执行顺序

```text
1. R8.7 / R8.8 无感加载与缓存竞态修复       ✅ Production
2. R10.1 Supabase 微信调度                   ✅ Production DB
3. R10.1 网页绑定/测试代码 + CI              ⏳ PR #59
4. 获得授权后做一次受控 Vercel Production      ⏳
5. Cat / Fish 分别绑定 PushPlus + 真微信测试    ⏳
6. 激活 Harbor Cat / Fish Apps Script Workers ⏳
7. Harbor 读写 / 照片 / watch / fallback 验收  ⏳
8. Cat backup / restore 验收                  ⏳
```

## 10. 部署纪律

**任何后续 Vercel Preview 或 Production deployment 都必须逐次获得用户明确许可。**
