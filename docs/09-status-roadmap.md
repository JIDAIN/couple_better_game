# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细视觉规范见 `docs/12-island-life-design-system.md`；R1-R6 计划见 `docs/16-v2-refactor-plan.md`；固定双账号与权限边界见 `docs/17-auth-and-pairing.md`；R8.1 UI 收口见 `docs/30-r8-ui-closeout.md`；R8.2 实机校准见 `docs/31-r8-2-ui-calibration.md`；R10 Drive Bridge 见 `docs/25-*` 至 `docs/29-*`。

## 1. 主功能状态

```text
V2-P0  新旧系统边界 /game                    ✅
V2-P1  心情 / 睡眠 / 活动 facts + API         ✅
V2-UI  岛屿生活视觉语言 + App* 基础            ✅
V2-P2  今日首页                               ✅
V2-P3  独立饮食 + 编辑 + 照片                  ✅
V2-P4  月历 + 日期详情                         ✅
V2-P5  小窝 + 体重                             ✅
V2-P6  家庭药箱                                ✅
V2-P7  小信箱                                  ✅
V2-P8  游戏机列表 -> /game                     ✅
R1-R7  重构与移动端校准                         ✅
R8     数据管理 + MCP Production                ✅ 底层
R8.1   第一轮视觉/交互收口                       ✅ Production
R8.2   Production 实机视觉二次校准               ✅ 代码/CI，待合并
R9     程序内置 AI Agent                        ✅ 代码/CI，非主入口
R10    双 Harbor + Google Drive Bridge           ✅ Production backend
R10    Worker Pairing Production                 ✅ 后端已上线
R10    Cat/Fish Apps Script Workers              ⏳ 待一次性人工激活
```

## 2. 固定身份与权限

底层只有两个固定身份：

```text
cat
fish
```

相对 UI：

```text
cat 登录  -> 我=cat,  Ta=fish
fish 登录 -> 我=fish, Ta=cat
```

个人心情、睡眠、体重等只允许本人写；共同活动、药箱、纪念日继续按共享领域规则处理。

Harbor 入口：

```text
Harbor Cat  / 团子 -> authoritative actor = cat
Harbor Fish / 仔仔 -> authoritative actor = fish
```

“团子 / 仔仔”只用于会话识别，不替代服务端 cat/fish 身份。

## 3. R8 / R8.1 / R8.2

R8 Production 数据能力包含：

- `anniversary_date`
- actor-only `target_weight_kg`
- mailbox `title / theme_key`
- transactional backup/export/restore/import
- MCP OAuth/PKCE

R8.1 完成了 23 项结构与交互收口，并随统一 Production deployment 上线。

Production 手机实机截图随后确认视觉仍有第二层问题，因此 R8.2 不再以“组件存在”为验收标准，而按真实手机密度重新校准：

- 首页“一起度过的第 N 天 ♡”重新排版；
- 心情/睡眠/活动右上控制缩成真正的小描边框；
- 心情 picker 去掉背景圈/阴影/选中框，图标放大，点选即关闭；
- 活动改成默认 icon + 自由文本 + Notion 风格 icon popover；
- 小窝统一项目 SVG，并给右箭头独立布局列；
- 小信箱保留结构，但改成低阴影纸张/中文衬线阅读层级；
- “我的 → 数据管理”改为真正 `/me/data`，接入 R8 已存在的事务备份、恢复点、完整 JSON 导出/导入；
- 新增 `import_life_full_data`，使 R10 `user + config` full export 可完整恢复；
- 恢复/导入要求 `确认恢复生活数据`，并继续由底层自动创建 `pre_restore` 保护点。

R8.2 CI #256：

```text
Test   ✅
Lint   ✅
Build  ✅
```

详细见 `docs/31-r8-2-ui-calibration.md`。

## 4. R9

R9 建立了：

```text
/ai
/api/ai/chat
life_capabilities / life_query / life_mutate
```

其 canonical registry 和权限层继续被 R10 复用。`/ai` 页面保留为备用入口，但用户主入口为 ChatGPT Project 内的 Harbor Cat / Harbor Fish。

## 5. R10 双 Harbor 架构

```text
Harbor Cat --------------------┐
                               ├-> Couple Better Game -> Supabase
Harbor Fish -------------------┘

Google Drive
├─ AI-Bridge/Cat
├─ AI-Bridge/Fish
├─ Originals/Meals/Cat
├─ Originals/Meals/Fish
├─ Backups/Daily
└─ Backups/Monthly
```

原则：

- 一个程序、一个 Supabase、一个家庭灾备；
- Cat/Fish 两张 Bridge Sheet 只是独立 AI 入口和状态镜像；
- `STATE_*` 不是事实源；
- `COMMANDS` 经 HMAC worker -> canonical `life_mutate` 才能真正改库；
- 原始餐食照片永久保留在 Drive，程序使用压缩 WebP；
- Cat 为唯一 backup leader，Fish 为 follower。

## 6. R10 Production 当前真实状态

当前统一 Production：

```text
deployment: dpl_3WHMG5Voo9YRgHByxjKHZQKHgT43
status: READY
source commit: 3775d90311b11f4d39e93b816e13f5332e1efff5
primary domain: https://couple-better-game.vercel.app
```

该部署已经同时包含 R8.1、Worker Pairing、双 Harbor Bridge 和微信提醒后端。

已验证关键路由：

```text
/api/drive-bridge/bootstrap
/api/drive-bridge/execute
/api/drive-bridge/reminders
/api/drive-bridge/snapshot
/api/drive-bridge/stage
/api/drive-bridge/watch
/api/life/settings
```

Worker Pairing 已具备：

- Cat/Fish pairing migration 已应用 Production；
- 两张 Bridge Sheet 均为 `pairing_status=ready`；
- pairing code 与精确 Sheet / actor 绑定；
- pairing code 成功使用后立即作废；
- 长期 HMAC/watch/wake secret 只写入 Apps Script Script Properties；
- Worker 会自动回填自己的 Apps Script Web App URL。

当前数据库仍显示：

```text
cat.apps_script_url  = empty
fish.apps_script_url = empty
```

原因不是后端缺失，而是两个 Google Apps Script Worker 尚未由用户在 Google 页面创建并部署。

## 7. 微信提醒

R10 已完成 PushPlus 微信提醒代码和 Production DB migration：

```text
Harbor Cat  -> 团子提醒 -> Cat PushPlus token
Harbor Fish -> 仔仔提醒 -> Fish PushPlus token
```

默认：

- 每日 21:15：本人当天完全没有生活记录时轻提醒；
- 纪念日 09:15：提前 7 天 / 1 天 / 当天；
- 不做竞争、排名或连续催促；
- delivery ledger 防重复；
- PushPlus token 只进入各自 Apps Script Script Properties。

功能代码和后端已经上线，真正发微信仍依赖 Cat/Fish Worker 激活并分别配置自己的 PushPlus token。

## 8. Google Drive 与备份

Supabase 始终是结构化数据事实源；Drive 负责：

```text
原始照片
AI Bridge
Daily / Monthly 全量 JSON 灾备
```

不在 GitHub 保存私人生活数据或照片。备份保持一份家庭级全量备份，不为 Cat/Fish 复制两套。

## 9. 当前执行顺序

```text
1. R8.2 实机问题修正                        ✅
2. R8.2 真实数据管理接入                     ✅
3. R8.2 Test / Lint / Build                 ✅ CI #256
4. R8.2 合并 main                           <- 当前
5. R8.2 Supabase full-import migration 验证
6. 等用户新的明确许可后部署 R8.2 Production
7. Production 手机实机截图二次验收
8. 激活 Harbor Cat / Fish Apps Script Workers
9. Harbor 真实读写 / 照片 / watch / backup 验收
10. Cat/Fish PushPlus 真实微信验收
```

Worker 激活暂时不与 R8.2 UI 开发混在一起，避免一边改可见页面一边调外部 worker。

## 10. 部署纪律

当前 `vercel.json`：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

**任何后续 Vercel Preview 或 Production deployment 仍必须逐次获得用户明确许可。** R8.2 本轮尚未获得新的部署授权。
