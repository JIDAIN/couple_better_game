# 当前状态与 Roadmap

**状态日期：2026-09-06**

R11.5 详细说明见：

`docs/45-r11-5-meal-nutrition-photo-display.md`

Harbor 当前 Project 指令模板见：

`docs/46-harbor-mcp-project-instructions.md`

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
Google Drive / Sheet Bridge              ⚪ 兼容回滚入口，不再默认使用
R8.7-R8.8 无感加载 / 缓存竞态收口          ✅ Production
前台恢复 / focus 自动后台校验              ✅ Production
R11.4 MCP 图片恢复链路                     ✅ Production
ChatGPT MCP 临时文件直传                   ✅ Production / 已验收
R11.5 AI 饮食草稿软确认                    ✅ Production
R11.5 营养字段完整化                       ✅ Production
R11.5 照片旋转 / 大小 / 无裁切显示          ✅ Production
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

正式主路径：

```text
Harbor Cat Project
→ Harbor-Cat MCP
→ OAuth cat
→ /mcp

Harbor Fish Project
→ Harbor-Fish MCP
→ OAuth fish
→ /mcp

其他 MCP client
→ /mcp

程序内置 AI
→ /api/ai/chat

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

Google Sheet / Drive Bridge 的 COMMANDS、RECEIPTS、STATE_* 只保留作兼容 / 回滚层，不再进入 Harbor 正常读写路径。

## 4. Harbor MCP 已完成验收

2026-09-06 已实测：

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

因此 Harbor 正常请求不再创建 COMMAND、不等待 RECEIPT、不触发 Fast Wake。

## 5. Google Bridge 当前定位

旧路径：

```text
COMMAND
→ Fast Wake
→ RECEIPT
→ life_query / life_mutate
```

当前仅作为短期回滚兼容能力保留。

原则：

- 正常 Harbor 业务不再使用 Bridge；
- `STATE_*` 不作为事实源；
- 不主动扫描 RECEIPTS；
- 不主动触发 Fast Wake；
- 只有 MCP 明确不可用且用户要求兼容通道时才考虑 Bridge；
- 暂不物理删除后端代码/资源，待一段真实使用稳定后再决定清理。

## 6. R11.5 饮食交互

新的 meal：

```text
图片 / 文字
→ AI 分析实际摄入
→ 聊天中展示待确认草稿
→ 用户修改 / 确认
→ 正式 life_mutate
```

草稿状态属于聊天上下文：

- 无 `meal_drafts` 后台表；
- 无 server-side draft state；
- 服务端不再匹配“确认 / 可以 / 好的”等关键词决定 meal create；
- 用户已经确认后，如果写入临时失败，再说“再试一次”应继续重试已确认操作。

身份、权限、删除、高风险覆盖、幂等等真正安全边界继续由服务端保证。

## 7. R11.5 实际摄入与营养

默认优先级：

```text
用户明确文字
>
餐前 / 餐后差分
>
单图估算
```

确认后的正式 meal 在能合理判断时尽量一次填写：

```text
portion
estimated weight
calories
protein
carbs
fat
total calories
```

未知字段允许 `null`；不使用虚假精度。

UI 手动编辑已有 AI meal 时，现有重量、宏量营养、calorie range 等必须 round-trip 保留，除非用户真正修改相关字段。

## 8. R11.5 餐食照片

当前正式 meal 仍绑定 1 张展示照片。

多图聊天：

```text
餐前图 + 餐后图都可用于 AI 差分
→ 未特别指定时正式保存餐前图
→ 餐后图默认只用于估算
```

图片上传：

```text
EXIF normalize
→ 600px WebP
→ Storage
→ photo_path
```

ChatGPT Custom MCP 当前已验收可从 OpenAI 临时文件地址获取图片并写入 Supabase Storage。

新增显示元数据：

```text
photo_rotation_degrees = 0 / 90 / 180 / 270
photo_scale            = 0.60 .. 1.00
```

竖图默认 90° 横向显示。

饮食编辑页支持：

- 左 / 右旋转 90°；
- 60%–100% 大小；
- 更换 / 移除照片。

真实照片统一 `object-contain + 留白`，用户设成竖向时不强裁切内容。

## 9. 无感加载 / 数据同步

当前网页策略：

```text
先显示 Cat/Fish scope 下的本地 stale cache
→ 页面挂载后后台强制校验最新数据
→ focus / visibilitychange 后后台强制刷新
→ online 后后台强制刷新
```

目标是：

```text
不白屏
不出现显式刷新条
不整页闪烁
同时不长期停留在旧数据
```

2026-09-06 已通过真实验收：ChatGPT 写入 1 分钟活动后，从 ChatGPT 切回网页，无手动刷新即可自动出现；网页删除后 Supabase 立即软删除。

## 10. 数据库状态

R11.5 migration：

`supabase/migrations/20260906160000_add_meal_photo_display_transform.sql`

已在 Production Supabase 执行成功。

主要新增：

```text
meals.photo_rotation_degrees
meals.photo_scale
replace_meal_photo_state(...)
update_meal_photo_display(...)
```

Meal kcal / macros 当前允许 nullable：

```text
NULL = 未估算
0    = 确实为 0
```

## 11. 当前 Production

Primary domain：

`https://couple-better-game.vercel.app`

当前已部署版本包含前台恢复自动校验：

```text
deployment: dpl_VNd6Emg1xe1GZGcv9QgjfNBAdLQA
state: READY
target: production
source commit: 0a293a2e1994f82b256564326350f62396f10cb4
```

部署完成后自动部署已恢复关闭。

当前 `vercel.json`：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

## 12. 已知边界

当前仍存在的明确边界：

- `mood` 当前只有 `upsert`，还没有正式 `delete`；
- 一个 meal 只能正式绑定 1 张展示照片；
- 餐前 / 餐后可以一起用于 AI 分析，但还没有多图持久化模型；
- Server-side vision recognizer 没有配置付费 key 时会安全跳过识别，不影响照片保存；
- RikkaHub / 某些 MCP 客户端不透传图片字节时需要 browser recovery；
- 内置网页 AI 当前单次附件能力与 ChatGPT Project 多图会话能力不完全相同；
- Google Bridge 仍存在代码与资源，但已不属于默认 Harbor 流程；
- Production 自动部署长期保持关闭。

## 13. 下一步候选

优先级按真实使用需求决定，不自动开发：

```text
1. 给 mood 增加正式 delete 能力
2. 做一次 Cat / Fish “我 / Ta / both”完整权限回归
3. 持续真实使用 Harbor-Cat / Harbor-Fish，稳定后再物理退役 Bridge
4. 实机验证餐前 / 餐后差分草稿与完整营养写入
5. 如确实需要，再设计 meal 多图持久化模型
6. 后续新增 cycle 等生活 domain 时复用 AI Access Core
```

## 14. 部署纪律

任何新的 Production deployment 都必须获得用户当次明确授权。

一次“允许部署”只授权当前一次部署。部署完成后必须恢复：

`git.deploymentEnabled = false`
