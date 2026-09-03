# 当前状态与 Roadmap

**状态日期：2026-09-03**

详细视觉规范见 `docs/12-island-life-design-system.md`；R8.1 见 `docs/30-r8-ui-closeout.md`；R8.2 见 `docs/31-r8-2-ui-calibration.md`；R8.3 见 `docs/32-r8-3-visual-polish.md`；R10 Drive Bridge 见 `docs/25-*` 至 `docs/29-*`。

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
R8.3   信息减法 + 饮食汇总 + 药箱/我的重排         ✅ Production
R8.3   关系天数 / 活动图标面板 hotfix             ✅ Production
R9     程序内置 AI Agent                        ✅ 备用能力，不展示在“我的”
R10    双 Harbor + Worker Pairing 后端            ✅ Production
R10    Cat/Fish Apps Script Workers              ⏳ 待一次性人工激活
```

## 2. 固定身份与 Harbor

```text
cat 登录  -> 我=cat,  Ta=fish
fish 登录 -> 我=fish, Ta=cat

Harbor Cat  / 团子 -> authoritative actor = cat
Harbor Fish / 仔仔 -> authoritative actor = fish
```

“团子 / 仔仔”只用于会话识别；服务端权限始终绑定 `cat / fish`。

## 3. R8.2 / R8.3 UI 收口

R8.2 解决第一轮 Production 实机差距：

- 首页关系行与小型描边操作；
- 心情 picker 去背景圈/阴影并点选即保存；
- 活动改为自由文本 + Notion 风格 icon picker；
- 小窝 SVG 与独立 chevron 布局；
- 小信箱纸张阅读层级；
- `/me/data` 接入真实备份/恢复。

R8.3 继续按手机实机反馈做信息减法：

- 我/Ta 心情卡统一底色，睡眠圆环统一同一颜色和深浅；
- 删除解释“程序怎么工作”的副标题，保留温暖氛围文字；
- 饮食新增可复用 `DailyNutritionSummary`，展示当日 kcal、碳水/蛋白质/脂肪克数与热量占比；
- 日历历史日期复用同一饮食汇总，并正确把历史 `date` 传给饮食页；
- 已有餐食编辑入口统一为铅笔 SVG；
- 小信箱用户术语改为“手札 / 明信片”，数据库 `letter / postcard` 不迁移；
- 药箱按库存、状态、最终失效日优先重新设计；
- 游戏机删除“开始游戏 →”，改为视觉语言统一 chevron；
- “我的”昵称改为“小猫 / 小鱼”，删除 CURRENT ACCOUNT、身份映射、写入权限和生活 AI 助手卡；
- 数据管理删除新版/旧版程序关系、去游戏机和架构长说明，只保留备份、导出、导入、恢复。

2026-09-03 晚间实机 hotfix：

- 首页“一起度过的第 N 天”整体字号放大；
- `N` 单独放大一档，并改为更亮的暖粉强调色；
- 句末单爱心改为项目内双爱心 SVG；
- 活动 icon picker 在手机端固定到导航上方，`z-index` 高于底部导航；
- icon grid 增加可滚动最大高度，保证 30 个活动图标都可查看；
- 380px 以下屏幕自动降为 5 列。

Hotfix PR #51：

```text
merge commit: a0ab9f21b268cb770f494bcc68fb36ec075a75b3
CI #268:
Test   ✅
Lint   ✅
Build  ✅
```

## 4. 数据管理安全模型

完整生活数据管理继续使用 R8/R8.2 的事务模型：

```text
create backup
export full JSON
import full JSON
restore snapshot
```

恢复 / 导入要求：

```text
确认恢复生活数据
```

底层 `restore_life_backup_snapshot` 会先创建 `pre_restore` 完整保护点，再修改数据。

`import_life_full_data` Production 权限：

```text
service_role  ✅
authenticated ❌
anon          ❌
```

旧游戏覆盖仍使用独立确认语 `确认覆盖游戏数据`。

## 5. 当前 Production

```text
primary domain: https://couple-better-game.vercel.app
deployment: dpl_B71YH8fSWiQYnckrmDXzzAftc3bz
status: READY
hotfix source commit: c384fd048de3d6a1691f6d654730adec6d53e9a9
hotfix code merge: a0ab9f21b268cb770f494bcc68fb36ec075a75b3
```

本次使用一次受控 Git Production 触发：临时开启 `main` deployment，Vercel 创建唯一 Production 后立即恢复 `deploymentEnabled: false`。

Production 验证：

```text
Build / TypeScript / static generation ✅
/                                      200
主域名 alias                            ✅
最近 20 分钟 runtime errors             0
本次新增 Production 数量                1
Git deploymentEnabled                   false
```

## 6. R10 与微信提醒

双 Harbor 后端与 PushPlus 提醒后端已在 Production：

```text
Harbor Cat  -> 团子提醒 -> Cat PushPlus token
Harbor Fish -> 仔仔提醒 -> Fish PushPlus token
```

默认提醒：

- 每日 21:15：本人当天完全没有生活记录才轻提醒；
- 纪念日 09:15：提前 7 天 / 1 天 / 当天；
- delivery ledger 防重复；
- token 只进入各自 Apps Script Script Properties。

当前剩余外部步骤仍是 Cat/Fish Google Apps Script Worker 的一次性人工创建、授权和发布。Worker 激活后再做 Harbor 真实读写、照片、watch、backup 和 PushPlus 真机验收。

## 7. 数据与备份

```text
Supabase -> 结构化生活数据事实源
Drive    -> 餐食原图 + AI Bridge + Daily/Monthly 全量灾备
浏览器   -> 仅页面缓存
```

家庭备份始终只有一套，Cat 为 backup leader，Fish 为 follower。

## 8. 当前执行顺序

```text
1. R8.3 视觉与信息层级修改                  ✅
2. R8.3 Test / Lint / Build               ✅ CI #263
3. PR #50 合并 main                       ✅
4. R8.3 Production 部署                   ✅
5. 关系天数 / icon picker hotfix           ✅ PR #51 / CI #268
6. Hotfix Production 部署                 ✅ dpl_B71YH8...
7. 用户手机实机截图继续视觉验收              <- 当前
8. 激活 Harbor Cat / Fish Apps Script Workers
9. Harbor 读写 / 照片 / watch / backup 验收
10. Cat/Fish PushPlus 真实微信验收
```

## 9. 部署纪律

`vercel.json` 当前仍为：

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

**任何后续 Vercel Preview 或 Production deployment 都必须逐次获得用户明确许可。**
