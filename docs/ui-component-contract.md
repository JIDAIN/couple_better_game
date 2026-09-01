# UI 组件契约

## 核心入口

- `components/ui/AppScene.tsx`：动物岛场景层，包含 `AppSceneBoard`、`AppSceneTitle`、`AppSectionPanel`、`AppItemRow`、`AppAnimalGuide`、`AppMascotPair`、`AppNookPhoneFrame`。
- `components/ui/AppButton.tsx`：唯一按钮 wrapper，底层使用 `animal-island-ui/Button`。
- `components/ui/AppCard.tsx`：卡片 wrapper，底层使用 `animal-island-ui/Card`。
- `components/ui/AppDialog.tsx`：弹窗优先使用 `animal-island-ui/Modal`。
- `components/ui/AppGameIcon.tsx`：图标统一入口，优先官方 `Icon`，不足时登记 fallback。

## 页面场景映射

- 今日页：`scene="notice-board"`，岛屿公告板。
- 地图页：`scene="growth-map"`，成长地图板。
- 商店页：`scene="shop"`，Nook 小商店货架。
- 小窝页：`scene="nook-phone"`，NookPhone 屏幕。
- 成长日志：`scene="notebook"`，手账本。
- 数据管理：`scene="toolbox"`，岛屿存档工具箱。
- 规则说明：`scene="rules-board"`，岛民规则公告栏。

## 约束

- UI 不直接读写 `localStorage`。
- 页面 UI 只消费 `useHomeResources()` 暴露的数据和 action。
- `lib/home/**`、`tests/**`、`app/api/**`、`package.json`、`package-lock.json`、`HomeResourcesProvider.tsx` 不参与本次视觉迁移。
