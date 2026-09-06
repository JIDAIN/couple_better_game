# 当前状态与 Roadmap

**状态日期：2026-09-06**

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
R8.7-R8.8 无感加载 / 缓存竞态收口          ✅ Production
前台恢复 / focus 自动后台校验              ✅ Production
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

## 5. 饮食交互

```text
图片 / 文字
→ AI 分析实际摄入
→ 聊天中展示待确认草稿
→ 用户修改 / 确认
→ life_mutate
```

草稿状态属于聊天上下文。身份、权限、删除、高风险覆盖、幂等等真正安全边界由服务端保证。

## 6. 实际摄入与营养

默认优先级：

```text
用户明确文字 > 餐前 / 餐后差分 > 单图估算
```

能合理判断时尽量一次填写 portion、estimated weight、calories、protein、carbs、fat；未知字段允许 `null`。

## 7. 餐食照片

当前正式 meal 绑定 1 张展示照片。多图可参与 AI 差分；未特别指定时保存餐前图。

```text
EXIF normalize
→ 600px WebP
→ Storage
→ photo_path
```

ChatGPT Custom MCP 已验收可从 OpenAI 临时文件地址获取图片并写入 Supabase Storage。

## 8. 无感加载 / 数据同步

```text
先显示 Cat/Fish scope 下的本地 stale cache
→ 页面挂载后后台强制校验最新数据
→ focus / visibilitychange 后后台强制刷新
→ online 后后台强制刷新
```

真实验收已通过：ChatGPT 写入后，从 ChatGPT 切回网页无需手动刷新即可自动出现；网页删除后 Supabase 立即软删除。

## 9. 当前 Production

Primary domain：`https://couple-better-game.vercel.app`

```text
deployment: dpl_VNd6Emg1xe1GZGcv9QgjfNBAdLQA
state: READY
target: production
source commit: 0a293a2e1994f82b256564326350f62396f10cb4
```

当前仓库正在清理已废弃的旧传输实现；该代码清理在获得下一次明确 Production 部署授权之前不会改变线上运行版本。

当前 `vercel.json` 保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

## 10. 已知边界

- `mood` 当前只有 `upsert`，还没有正式 `delete`；
- 一个 meal 只能正式绑定 1 张展示照片；
- 餐前 / 餐后可以一起用于 AI 分析，但还没有多图持久化模型；
- Server-side vision recognizer 没有配置付费 key 时会安全跳过识别，不影响照片保存；
- 某些 MCP 客户端不透传图片字节时需要 browser recovery；
- 内置网页 AI 当前单次附件能力与 ChatGPT Project 多图会话能力不完全相同；
- Production 自动部署长期保持关闭。

## 11. 下一步候选

```text
1. 给 mood 增加正式 delete 能力
2. 做一次 Cat / Fish “我 / Ta / both”完整权限回归
3. 实机验证餐前 / 餐后差分草稿与完整营养写入
4. 如确实需要，再设计 meal 多图持久化模型
5. 后续新增 cycle 等生活 domain 时复用 AI Access Core
```

## 12. 部署纪律

任何新的 Production deployment 都必须获得用户当次明确授权。一次“允许部署”只授权当前一次部署；完成后必须恢复 `git.deploymentEnabled=false`。
