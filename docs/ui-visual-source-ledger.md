# Animal Island UI 视觉来源登记

## 官方来源

- `animal-island-ui@0.9.4`
- `node_modules/animal-island-ui/AI_USAGE.md`
- `node_modules/animal-island-ui/dist/types/index.d.ts`
- `animal-island-ui/style`
- `public/animal-island-ui/content_bg_pc.jpg`
- `public/animal-island-ui/home_bg.webp`
- `public/animal-island-ui/menu_bg.svg`
- `docs/animal-island-ui-design-spec.md`

## 已使用官方组件

- `Button`：经 `AppButton` / `AppBottomNavItem` 使用。
- `Card`：经 `AppCard` / `AppSceneBoard` / `AppSectionPanel` 使用。
- `Input`：经 `AppInput` 使用。
- `Modal`：经 `AppModal` 使用。
- `Divider`：用于公告板、地图板和场景装饰线。
- `Footer`：用于今日、地图、商店的轻量装饰。
- `Icon`：经 `AppGameIcon` 映射官方图标。
- `Phone`：经 `AppNookPhoneFrame` 用作 NookPhone 场景来源。
- `Cursor`：在 `app/layout.tsx` 全局挂载。

## Fallback 登记

- 官方包没有稳定命名的猫猫、鱼鱼、宝石、金币等素材，`AppRoleAvatar` 与 `AppGameIcon` 内仍保留 wrapper fallback。
- 原生 `input` fallback 保留在文件选择、checkbox、紧凑数字输入。
