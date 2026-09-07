# 当前状态与 Roadmap

**状态日期：2026-09-07**

Harbor 当前 Project 指令模板：`docs/46-harbor-mcp-project-instructions.md`。

## 1. 当前主功能状态

```text
今日 / 心情 / 睡眠 / 活动                ✅ Production
饮食 + Meal CRUD + 私有照片              ✅ Production
日历 + 双人心情                           ✅ Production
小窝 / 体重 / 家庭药箱 / 小信箱 / 游戏机   ✅ Production
Legacy Game                              ✅ 保留
MCP / AI Access Core                     ✅ Production
Harbor-Cat direct MCP                    ✅ Production / 已验收
Harbor-Fish direct MCP                   ✅ Production / 已验收
Google Drive / Sheet Harbor Bridge       ✅ 已从 Production runtime 退役
R8.7-R8.8 无感加载 / 缓存竞态收口          ✅ Production
前台恢复 / focus 自动后台校验              ✅ Production
ChatGPT MCP 临时文件直传                   ✅ Production / 已验收
R11.5 AI 饮食草稿软确认                    ✅ Production
R11.5 营养字段完整化                       ✅ Production
R11.5 照片旋转 / 大小 / 无裁切显示          ✅ Production
提醒中心 / Reminder Engine 核心            ✅ Production
Reminder Center V1 数据层收尾              ✅ Supabase
Reminder Center V1 UI 收尾                🟡 GitHub main，待下一次授权部署
PushPlus Cat                              ✅ 已绑定 / 实机自动提醒验收通过
PushPlus Fish                             ⏳ 待绑定
药箱自动到期提醒                           ✅ Reminder Engine
纪念日提醒进入 Reminder Center             ✅ Supabase
mood delete RPC                           ✅ Supabase
mood delete Web/API/MCP                   🟡 GitHub 已完成，待下一次授权部署
```

## 2. 固定身份

Harbor Cat：

```text
Harbor-Cat OAuth actor = cat
我 = cat
Ta / 对象 = fish
团子 = AI 昵称
```

Harbor Fish：

```text
Harbor-Fish OAuth actor = fish
我 = fish
Ta / 对象 = cat
```

AI 昵称、用户自称或普通文本 `person` 不参与服务端身份判断；身份来自 OAuth / 登录授权上下文。

## 3. 当前 AI 入口

```text
Harbor Cat Project → Harbor-Cat MCP → OAuth cat → /mcp
Harbor Fish Project → Harbor-Fish MCP → OAuth fish → /mcp
其他 MCP client → /mcp
程序内置 AI → /api/ai/chat
        ↓
life_query / life_mutate
        ↓
AI Access Core
        ↓
canonical domain services
        ↓
Supabase
```

Supabase 是正式生活数据事实源。

## 4. Harbor MCP 已完成验收

```text
Harbor-Cat OAuth                         ✅
Harbor-Cat life_query                    ✅
Harbor-Cat life_mutate                   ✅
Harbor-Cat ChatGPT 图片 → meal + photo   ✅
Harbor-Fish OAuth                        ✅
Harbor-Fish life_query                   ✅
Harbor-Fish life_mutate                  ✅
Cat / Fish token-bound identity          ✅
ChatGPT 写入 → Supabase → 网页自动刷新   ✅
网页删除 → Supabase                      ✅
```

## 5. 提醒层

当前结构：

```text
生活模块 / 自定义提醒
        ↓
Reminder Engine
        ↓
life_reminder_rules / life_reminder_instances
        ↓
网页提醒中心 + PushPlus
        ↓
Cat / Fish
```

V1 当前能力：

```text
自定义提醒                               ✅
完成 / 忽略 / 1 小时后                  ✅
药箱到期提醒                             ✅
药箱提醒开关 / 提前天数                  ✅ Supabase + GitHub UI
纪念日提醒进入 Reminder Center           ✅
首页最近 3 条提醒                        🟡 GitHub main，待部署
今天 / 即将到来 / 已完成                🟡 GitHub main，待部署
PushPlus 状态整合到提醒设置              🟡 GitHub main，待部署
PushPlus 云端 5 分钟调度                 ✅
Cat 微信自动提醒                         ✅ 实机验收
Fish 微信自动提醒                        ⏳ 待绑定验收
```

额外修正：已修复“提醒成功推送后再点稍后提醒不会再次推送”的问题。snooze 现在会重置 `notified_at`，并按新的 effective due time 生成新的 delivery dedupe key。

每日未记录提醒继续作为低噪音 system nudge 即时判断，不进入长期 Reminder Center 列表。

提醒完整说明见 `docs/14-wechat-reminders.md`。

## 6. 饮食交互

```text
图片 / 文字
→ AI 分析实际摄入
→ 聊天中展示待确认草稿
→ 用户修改 / 确认
→ life_mutate
```

草稿状态属于聊天上下文。身份、权限、删除、高风险覆盖、幂等等真正安全边界由服务端保证。

## 7. 实际摄入与营养

默认优先级：

```text
用户明确文字 > 餐前 / 餐后差分 > 单图估算
```

能合理判断时尽量一次填写 portion、estimated weight、calories、protein、carbs、fat；未知字段允许 `null`。

## 8. 餐食照片

当前正式 meal 绑定 1 张展示照片。多图可参与 AI 差分；未特别指定时保存餐前图。

```text
EXIF normalize
→ 600px WebP
→ Storage
→ photo_path
```

ChatGPT Custom MCP 已验收可从 OpenAI 临时文件地址获取图片并写入 Supabase Storage。

## 9. 无感加载 / 数据同步

```text
先显示 Cat/Fish scope 下的本地 stale cache
→ 页面挂载后后台强制校验最新数据
→ focus / visibilitychange 后后台强制刷新
→ online 后后台强制刷新
```

真实验收已通过：ChatGPT 写入后，从 ChatGPT 切回网页无需手动刷新即可自动出现；网页删除后 Supabase 立即软删除。

## 10. 当前 Production

Primary domain：`https://couple-better-game.vercel.app`

```text
deployment: dpl_3NiisiVSyodYX2m9CvbeDVC2sVom
state: READY
target: production
source commit: 9f306e93a6a524eb7a2735829367f63b3a9b62eb
```

该 Production 已包含 Reminder Center 初版并验证 `/me/reminders` 200 正常。

2026-09-07 后续 reminder V1 UI closeout、mood delete Web/API/MCP 仍只在 GitHub `main`，尚未获得新的 Production 部署授权。

当前 `vercel.json` 保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

## 11. Supabase 当前提醒状态

已执行 `reminder_center_v1_closeout` migration：

```text
Cat medicine settings                    ✅ enabled / [30,7,1,0]
Fish medicine settings                   ✅ enabled / [30,7,1,0]
Cat PushPlus                             ✅ configured
Fish PushPlus                            ⏳ not configured
Anniversary instances                    ✅ Cat 3 / Fish 3 pending
Medicine instances                       ✅ Cat 12 / Fish 12 pending（当前数据）
life-reminder-materialize-v1             ✅ daily
life-pushplus-reminders-v1               ✅ every 5 minutes
```

实例数量会随药箱、纪念日、完成/忽略状态变化，上述数字只是 2026-09-07 收尾时的现场验证。

## 12. 安全与数据库状态

生活数据表继续采用：

```text
RLS enabled
+ anon/authenticated 无直接表权限
+ service_role / canonical RPC 访问
```

Supabase Advisor 的 `RLS enabled no policy` 在当前服务端封闭架构下属于 INFO，不为消除提示而开放客户端 policy。

已补齐此前缺失的外键索引，以及 Reminder Center 新增外键索引。

## 13. 已知边界

- mood delete 的 Supabase RPC 已生效；Web/API/MCP 代码已在 GitHub，等待下一次明确 Production 部署授权；
- Reminder Center V1 完整 UI 已在 GitHub，等待下一次明确 Production 部署授权；
- Fish 尚未绑定 PushPlus，所以 Fish / both 的真实微信投递还未做最终实机验收；
- 一个 meal 只能正式绑定 1 张展示照片；
- 餐前 / 餐后可以一起用于 AI 分析，但还没有多图持久化模型；
- Server-side vision recognizer 没有配置付费 key 时会安全跳过识别，不影响照片保存；
- 某些 MCP 客户端不透传图片字节时需要 browser recovery；
- 内置网页 AI 当前单次附件能力与 ChatGPT Project 多图会话能力不完全相同；
- 小信箱当前底层仍只有已寄出记录模型；要实现“收信箱 / 已寄出 / 待寄出、待寄出可编辑、寄出后不可编辑”，必须先升级 mailbox 状态模型，再收口 UI；
- `drive-bridge-staging` 仍有一个空 bucket 待通过 Storage API / Dashboard 删除；
- Production 自动部署长期保持关闭。

## 14. 下一步候选

```text
1. 下一次获授权时部署 Reminder Center V1 UI closeout + mood delete Web/API/MCP
2. 完成 Cat / Fish “我 / Ta / both”权限回归
3. 升级 mailbox 为 draft / sent 状态模型，再实现三箱 UI 与寄出后只读
4. Fish 绑定 PushPlus，并验收 Fish / both 推送
5. 实机验证餐前 / 餐后差分草稿与完整营养写入
6. 如确实需要，再设计 meal 多图持久化模型
7. 后续新增 cycle 等生活 domain 时复用 AI Access Core + Reminder Engine
```

## 15. 部署纪律

任何新的 Production deployment 都必须获得用户当次明确授权。一次“允许部署”只授权当前一次部署；完成后必须恢复 `git.deploymentEnabled=false`。
