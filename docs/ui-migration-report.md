# Animal Island UI 迁移报告

Result: Partial Success

## 迁移摘要

已把所有主要用户可见页面挂到动物岛场景层：

- 今日页：岛屿公告板 / 每日收获看板。
- 地图页：成长地图板。
- 兑换商店：Nook 小商店货架。
- 小窝页：NookPhone 屏幕。
- 成长日志：手账本。
- 数据管理：岛屿存档工具箱。
- 规则说明：岛民规则公告栏。

新增统一场景组件 `components/ui/AppScene.tsx`，使用官方 `Card`、`Divider`、`Footer`、`Phone` 与现有官方 public 素材组合页面场景。

## 验证结果

- Baseline build：通过。
- Baseline lint：通过。
- Baseline test：2 个既有失败。
- Final build：通过。
- Final lint：通过。
- Final test：仍为同 2 个失败，未新增失败。
- HTTP preview：`http://127.0.0.1:3002` 返回 200。
- Browser visual screenshot：未完成。3000 dev server 日志出现 `Panic in async function`，浏览器插件导航超时；生产预览 HTTP 可达。

## 残留扫描

- 未包装 `<button>`：0。
- 未包装 `<a>`：0。
- 旧视觉骨架：0。
- 旧 AppFrame 骨架：0。
- deep import：0。
- 原生 input：5 处 fallback。

## 安全性

- 未修改业务逻辑。
- 未修改 forbidden files。
- 未修改热力图日期、grid、level 语义。
- 未 commit。
- 未 push。

## 例外清单

- 官方素材缺少猫猫、鱼鱼、宝石、金币等稳定 bitmap，因此 `AppGameIcon` / `AppRoleAvatar` 仍保留 wrapper 内 fallback。
- 原生 input fallback 保留在文件选择、checkbox 和紧凑数字输入。
- 自动桌面/移动截图验收未完成，因此结果不能标记为 Full Success。

## 回退

见 `docs/ui-rollback-guide.md`。
