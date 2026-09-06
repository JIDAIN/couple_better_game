# R8.4：弱网无感切换与 R10 实用性复核

## 1. 问题来源

Production 实机继续使用后发现两类体验问题：

1. 页面之间切换时，部分页面仍会出现明显“重新加载”的感觉；
2. 网络临时不稳定时，身份确认或页面数据请求失败会让某些页面直接无法正常打开。

R1C 已经引入内存级 stale-while-revalidate，但它仍有三个缺口：

- 内存缓存会在页面重载 / WebView 回收后消失；
- `/api/auth/session` 任意失败都会被当成退出登录；
- 底部导航属于每个 page 内的 `LifeAppShell`，路由切换仍会 remount；
- 页面壳和 Next 静态资源没有离线缓存。

## 2. R8.4 修复

### 2.1 身份隔离的持久读缓存

`use-stale-query` 增加浏览器持久层：

```text
memory cache
    ↓
localStorage per actor
    ↓
Supabase truth
```

每个身份独立命名空间：

```text
cat cache
fish cache
```

持久内容只用于已读取的页面数据：

- 今日 / 月历；
- 餐食；
- 体重；
- 药箱；
- 信箱；
- 生活设置。

最多保存 120 个条目，超过 30 天的普通条目自动丢弃。缓存永远不是事实源，所有写操作仍必须经服务器权限校验。

### 2.2 网络失败不再等于退出登录

`LifeIdentityProvider` 现在区分：

```text
服务器明确返回 unauthenticated -> 真正退出
网络断开 / 5xx / 临时失败        -> 保留最近确认身份和本地数据
```

`sessionStorage` 只保存本标签页最近确认的 `cat/fish` scope。网络恢复后自动重新确认 session，并后台刷新已挂载 query。

因此弱网时 UI 可以继续显示最近数据，但任何写操作仍由服务端 cookie / actor 权限做最终决定。

### 2.3 底部导航持久化

底部导航从每个 `LifeAppShell` 上移到根布局中的 `PersistentLifeChrome`。

这样：

- 今日 / 饮食 / 日历 / 小窝 / 我的切换时导航本身不再卸载重建；
- 根 chrome 主动 prefetch 五个主页面；
- `/login`、`/game` 等非生活主界面不显示新版底栏。

### 2.4 App Shell Service Worker

新增 `/life-sw.js`：

- 预缓存主要生活页面壳；
- 缓存 `/_next/static` 和项目静态资源；
- 页面导航采用 2.5 秒 network-first，弱网超时后回落已缓存页面；
- **绝不缓存 `/api/*`、MCP、OAuth 响应**；
- API 数据弱网回退由身份隔离的 stale-query cache 负责。

## 3. R10 AI / 微信当前真实成熟度

### 已完成的后端能力

AI Bridge 已具备：

- Cat/Fish 固定身份 HMAC；
- `life_query / life_mutate` canonical registry；
- 个人写权限隔离；
- 共同药箱 / 共享设置；
- 命令 ledger + 幂等；
- Drive 原图身份目录校验；
- 600px WebP 展示图生成；
- Drive watch + 1 分钟 fallback 设计；
- 单一家庭 Daily / Monthly backup。

微信提醒后端已具备：

- Cat/Fish 独立偏好；
- daily no-record reminder；
- anniversary 7/1/0 day reminder；
- delivery ledger 防重复；
- claim 中断恢复；
- PushPlus accepted 后 complete 失败的本地保护逻辑。

### 尚未完成的关键外部激活

Production 数据库当前实际状态仍为：

```text
cat  worker_url_ready = false
fish worker_url_ready = false
cat  paired_at = null
fish paired_at = null
```

同时：

```text
life_drive_bridge_commands = 0 条真实命令
life_notification_deliveries = 0 条真实通知
```

所以现在只能说“后端和协议已经足够接近实用”，不能说 Harbor AI / 微信提醒已经真实可用。

## 4. 达到日常实用所需的最后验收

### AI

必须至少完成：

1. Cat/Fish Apps Script Web App 创建、授权、pair；
2. 两边 `setupR10All()`；
3. Harbor Cat / Fish Project Instructions 绑定正确 Bridge；
4. 两边真实 query / mutate；
5. 跨身份写入拒绝；
6. 真实餐食原图上传 -> Drive -> WebP -> Supabase -> 页面；
7. Drive watch 实测正常延迟；
8. webhook 失效后 1 分钟 fallback；
9. Cat Daily backup 实际生成；
10. 至少一次恢复演练。

### 微信提醒

必须至少完成：

1. 两个 Worker 分别配置本人的 PushPlus token；
2. 各完成一次真实测试消息；
3. 测试已有当天记录时 daily reminder 不发送；
4. 测试同一 dedupe key 不重复发送；
5. 测试一次 PushPlus/complete 失败后的重试路径。

## 5. 实用性结论

完成上面的 worker 激活和真机验收后，当前架构对**两个人的私人日常生活记录**是足够的，不需要再引入新的数据库、消息队列或付费基础设施。

预计主要容量瓶颈不是 Supabase/Vercel 请求量，而是 Google Drive 原始照片长期占用空间；后续增加容量阈值提醒即可。

如果未来扩展经期、更多提醒类型或新的生活模块，应继续通过 canonical `life_query / life_mutate` registry 增加 domain，不重新搭一套 AI Bridge。

## 6. 部署纪律

本轮可以代码、测试、PR、merge；没有新的用户明确许可时不执行 Vercel Preview / Production deployment。
