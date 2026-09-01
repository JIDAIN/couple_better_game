# UI Theme Adapter

本次迁移不自创私有主题，而是把页面挂到 `animal-island-ui` 的官方视觉材料上。

## 已完成

- 全局入口保留 `import "animal-island-ui/style"`。
- 背景继续使用 `public/animal-island-ui/content_bg_pc.jpg`。
- 新增 `app-scene-*` 布局层，只承担场景组合和布局。
- 清理残留旧视觉骨架：`ui-tinted-*`、`ui-ambient-*`、`animal-page`、`animal-stage`、`app-main-scroll`、`app-main-inner` 扫描为 0。

## 保留

- `app-button--*`、`app-card--*` 作为既有 wrapper class 保留，底层已通过 `AppButton` / `AppCard` 接官方组件。
- 热力图等级和 grid 语义未修改，只保留 UI wrapper。
