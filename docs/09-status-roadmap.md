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
R9     程序内置 AI Agent                        ✅ 备用能力，不展示在“我的”
R10    双 Harbor + Worker Pairing 后端            ✅ Production
R10    Cat/Fish Apps Script Workers              ⏳ 尚未激活
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
- `sessionStorage` 只保存当前标签页最近确认的 cat/fish scope；
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

## 4. 当前 Production

```text
primary domain: https://couple-better-game.vercel.app
deployment: dpl_Vm4tYAk8Z6aeubqY8F5ET86gjrmB
status: READY
source commit: 3920e327daec26565bf069395433ac77aff1446f
```

R8.4 Production 验证：

```text
/                         200
/life-sw.js               200
PersistentLifeChrome      已在 Production HTML
LifeServiceWorker         已在 Production bundle
最近 30 分钟 runtime errors  0
本次新增 Production 数量     1
```

本次采用一次受控 Git Production 触发：临时开启 `main` deployment，Production READY 后立即恢复关闭。

`vercel.json` 当前保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

## 5. R10 AI 当前真实状态

代码/协议已经具备：

- Cat/Fish 独立 HMAC 固定身份；
- canonical `life_query / life_mutate`；
- 个人数据写权限隔离；
- 共享药箱 / 设置；
- `(actor, command_id)` 幂等 ledger；
- Drive 原图身份目录隔离；
- 原图 -> 600px WebP -> Supabase Storage；
- Drive watch + 一分钟 fallback；
- Cat 单一家庭备份 leader。

但 Production 数据库实况仍为：

```text
cat  apps_script_url = empty / paired_at = null
fish apps_script_url = empty / paired_at = null
life_drive_bridge_commands = 0 条真实命令
```

因此 Harbor AI **后端设计足够，但目前还不能称为真实可用**。必须先激活并 pair 两个 Apps Script Worker，再做真实读写、照片、watch、fallback 和 backup 验收。

## 6. 微信提醒当前真实状态

Production 已有 Cat/Fish 两份提醒偏好：

```text
daily reminder       21:15  enabled
anniversary reminder 09:15  enabled
offsets              [7,1,0]
```

后端已有：

- daily no-record 判定；
- 纪念日提醒；
- delivery ledger 防重复；
- claim 超时恢复；
- PushPlus 失败最多 3 次重试；
- PushPlus accepted 后 complete 失败时避免重复发送。

但当前：

```text
life_notification_deliveries = 0
```

且两个 Apps Script Worker 尚未激活，因此 **微信提醒还没有真正发送过一条测试消息**。

## 7. 达到“日常实用”的最后验收

AI：

```text
1. 创建并发布 Cat / Fish Apps Script Web App
2. 分别完成 pairing + setupR10All()
3. Harbor Cat / Fish 绑定各自 Bridge
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
1. 两个 Worker 分别配置本人的 PUSHPLUS_TOKEN
2. Cat / Fish 各发送一条真实测试消息
3. 已有当天记录时不发送 daily reminder
4. 同 dedupe key 不重复发送
5. 模拟一次失败后重试成功
```

这些验收通过后，当前架构对两个人的私人日常使用已经足够，不需要再增加数据库、消息队列或额外付费基础设施。长期最可能的容量瓶颈是 Google Drive 原始照片空间。

## 8. 当前执行顺序

```text
1. R8.4 刷新 / 弱网修复                      ✅
2. R8.4 Test / Lint / Build                  ✅ CI #274
3. PR #52 合并 main                           ✅ 3232f834...
4. R8.4 Production 部署                      ✅ dpl_Vm4tYAk8...
5. 激活 Harbor Cat / Fish Apps Script Workers <- 下一步
6. Harbor 读写 / 照片 / watch / fallback 验收
7. Cat backup / restore 验收
8. Cat/Fish PushPlus 真实微信验收
```

## 9. 部署纪律

**任何后续 Vercel Preview 或 Production deployment 都必须逐次获得用户明确许可。**
