# 当前状态与 Roadmap

**状态日期：2026-09-06**

R11.5 详细说明见：

`docs/45-r11-5-meal-nutrition-photo-display.md`

## 1. 当前主功能状态

```text
今日 / 心情 / 睡眠 / 活动                ✅ Production
饮食 + Meal CRUD + 私有照片              ✅ Production
日历 + 双人心情                           ✅ Production
小窝 / 体重 / 家庭药箱 / 小信箱 / 游戏机   ✅ Production
Legacy Game                              ✅ 保留
MCP / AI Access Core                     ✅ Production
Harbor ChatGPT Bridge                    ✅ 可用兼容入口
R8.7-R8.8 无感加载 / 缓存竞态收口          ✅ Production
R11.4 MCP 图片恢复链路                     ✅ Production
R11.5 AI 饮食草稿软确认                    ✅ Production
R11.5 营养字段完整化                       ✅ Production
R11.5 照片旋转 / 大小 / 无裁切显示          ✅ Production
```

## 2. 固定身份

Harbor Cat：

```text
我 = cat
Ta / 对象 = fish
团子 = AI 昵称
```

Harbor Fish 按其固定 actor 规则执行。

AI 昵称不参与服务端身份判断；身份来自登录 / Bridge / MCP 授权上下文。

## 3. 当前 AI 入口

三个入口共享同一个 AI Access Core：

```text
Harbor ChatGPT Project
MCP /mcp
程序内置 AI /api/ai/chat
        ↓
life_query / life_mutate
        ↓
canonical domain services
        ↓
Supabase
```

Supabase 是正式生活数据事实源。

Google Sheet / Drive Bridge 的 COMMANDS、RECEIPTS、STATE_* 只是兼容传输与镜像层。

## 4. Harbor Fast Path

普通 query / mutate：

```text
1 COMMAND
→ 1 Fast Wake
→ 同 command_id RECEIPT
→ 回复用户
```

当前原则：

- 普通业务不先 `life_capabilities`；
- 不扫描整张 RECEIPTS；
- `locked / processing / receiptReady=false` 不重复 Wake；
- Fast Wake 200 不等于业务成功；
- 正式结果只认同 command_id RECEIPT。

## 5. R11.5 饮食交互

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

## 6. R11.5 实际摄入与营养

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

## 7. R11.5 餐食照片

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

## 8. 数据库状态

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

## 9. 测试状态

PR #84 最终合并：

```text
merge commit: 1aa0dcad94674061f10d4735192383d01209d8c8
CI #452:
Test  ✅
Lint  ✅
Build ✅
```

覆盖包括：

- AI 软确认 contract；
- MCP 营养字段 guidance；
- EXIF / portrait 默认旋转；
- photo rotation / scale 解析；
- `MealPhotoFrame` contain + 留白；
- 编辑器照片控件；
- 手动编辑不吞掉 AI 营养数据。

## 10. 当前 Production

Primary domain：

`https://couple-better-game.vercel.app`

本次文档同步与 R11.5 当前代码重新受控部署：

```text
deployment: dpl_C4BzUmM5AkV2PmNz5AgT31TPQaxb
state: READY
target: production
source commit: c2b2c2ecd0499eeb3e2a7202ea906df7bec446d0
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

## 11. 已知边界

当前仍存在的明确边界：

- 一个 meal 只能正式绑定 1 张展示照片；
- 餐前 / 餐后可以一起用于 AI 分析，但还没有多图持久化模型；
- Server-side vision recognizer 没有配置付费 key 时会安全跳过识别，不影响照片保存；
- RikkaHub / 某些 MCP 客户端不透传图片字节时需要 browser recovery；
- 内置网页 AI 当前单次附件能力与 ChatGPT Project 多图会话能力不完全相同；
- Production 自动部署长期保持关闭。

## 12. 下一步候选

优先级按真实使用需求决定，不自动开发：

```text
1. 实机验证照片默认方向 / 旋转 / 大小持久化
2. 实机验证“确认后失败 → 再试一次”不重复确认
3. 实机验证餐前 / 餐后差分草稿与完整营养写入
4. 如确实需要，再设计 meal 多图持久化模型
5. 调研可长期使用的免费 / 免费额度视觉识别 provider
6. 后续新增 cycle 等生活 domain 时复用 AI Access Core
```

## 13. 部署纪律

任何新的 Production deployment 都必须获得用户当次明确授权。

一次“允许部署”只授权当前一次部署。部署完成后必须恢复：

`git.deploymentEnabled = false`
