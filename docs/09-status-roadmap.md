# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细视觉规范见 `docs/12-island-life-design-system.md`；R8.1 见 `docs/30-r8-ui-closeout.md`；R8.2 见 `docs/31-r8-2-ui-calibration.md`；R10 Drive Bridge 见 `docs/25-*` 至 `docs/29-*`。

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
R8.2   Production 实机视觉二次校准               ✅ main / DB，待新部署许可
R9     程序内置 AI Agent                        ✅ 备用入口
R10    双 Harbor + Worker Pairing 后端            ✅ Production
R10    Cat/Fish Apps Script Workers              ⏳ 待一次性人工激活
```

## 2. 固定身份

```text
cat 登录  -> 我=cat,  Ta=fish
fish 登录 -> 我=fish, Ta=cat

Harbor Cat  / 团子 -> authoritative actor = cat
Harbor Fish / 仔仔 -> authoritative actor = fish
```

“团子 / 仔仔”只用于会话识别；服务端权限始终绑定 cat/fish。

## 3. R8.2 实机校准

2026-09-03 Production 手机截图确认 R8.1 仍有视觉和交互差距，因此 R8.2 以真实手机密度重新校准：

- 首页关系行改为“一起度过的第 N 天 ♡”，数字强调、爱心位于句末；
- 心情/睡眠/活动右上操作改为小型描边控件；
- 心情 picker 去掉背景圈、阴影和选中框，毛绒图放大，点选即关闭；
- 活动改为默认 icon + 自由文本，点击 icon 弹出 Notion 风格 30 项图标面板；
- 小窝四入口改为项目内统一 SVG，chevron 使用独立 Grid 列，不再与文字重叠；
- 小信箱保留功能结构，重新做纸张、中文衬线阅读层级、低阴影与手机卡片密度；
- “我的 → 数据管理”升级为真实 `/me/data`：恢复点、完整 JSON 导出、完整 JSON 导入、事务恢复。

R8.2 PR #49 已 squash 合并 main：

```text
241cf5e74bdfa3f6471664d49f2d76f33a523080
```

最终 CI #257：

```text
Test   ✅
Lint   ✅
Build  ✅
```

## 4. 数据管理安全模型

R8 原有数据库已经具备事务备份和恢复，R8.2 把这些能力真正接到可见 UI，并新增：

```text
import_life_full_data(user + optional config)
```

Production migration 已执行成功。

恢复 / 导入要求输入：

```text
确认恢复生活数据
```

底层 `restore_life_backup_snapshot` 在写入前始终创建 `pre_restore` 完整保护点。因此手动恢复、JSON 导入都不是不可逆覆盖。

权限核对：

```text
service_role  -> import_life_full_data EXECUTE ✅
authenticated -> EXECUTE ❌
anon          -> EXECUTE ❌
```

旧游戏覆盖仍沿用独立确认语 `确认覆盖游戏数据`，不与新版生活数据恢复混用。

## 5. R10 当前状态

当前 Production：

```text
deployment: dpl_3WHMG5Voo9YRgHByxjKHZQKHgT43
status: READY
primary domain: https://couple-better-game.vercel.app
```

该部署包含 R8.1、R10 Worker Pairing、双 Harbor Bridge 和微信提醒后端，但**不包含 R8.2**。

Cat/Fish 两张 Bridge Sheet 均已 `pairing_status=ready`。数据库仍为：

```text
cat.apps_script_url  = empty
fish.apps_script_url = empty
```

因此 R10 最后外部步骤仍是 Google Apps Script Worker 的一次性人工创建/授权/发布。

## 6. 微信提醒

已完成后端和 Production DB：

```text
Harbor Cat  -> 团子提醒 -> Cat PushPlus token
Harbor Fish -> 仔仔提醒 -> Fish PushPlus token
```

默认：

- 每日 21:15：本人当天完全没有生活记录才提醒；
- 纪念日 09:15：提前 7 天 / 1 天 / 当天；
- delivery ledger 防重复；
- token 仅进入各自 Apps Script Script Properties。

真正发微信仍依赖 Worker 激活。

## 7. 数据与备份

```text
Supabase -> 结构化生活数据事实源
Drive    -> 餐食原图 + AI Bridge + Daily/Monthly 全量灾备
浏览器   -> 仅页面缓存
```

家庭备份始终只有一套，Cat 为 backup leader，Fish 为 follower。

## 8. 当前执行顺序

```text
1. R8.2 六组实机问题修正                  ✅
2. R8.2 真实数据管理接入                   ✅
3. R8.2 Test / Lint / Build               ✅ CI #257
4. PR #49 合并 main                       ✅ 241cf5e...
5. R8.2 Supabase migration + 权限核对      ✅
6. 等用户新的明确许可后部署 R8.2 Production <- 当前部署边界
7. Production 手机实机截图再次验收
8. 激活 Harbor Cat / Fish Apps Script Workers
9. Harbor 读写 / 照片 / watch / backup 验收
10. Cat/Fish PushPlus 真实微信验收
```

## 9. 部署纪律

`vercel.json` 始终保持：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

**任何后续 Vercel Preview 或 Production deployment 都必须逐次获得用户明确许可。** R8.2 尚未获得新的 Production 部署授权。
