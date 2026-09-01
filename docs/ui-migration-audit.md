# UI 迁移审计

## 基线

- 分支：`feat/animal-island-ui-migration`
- 初始工作区：未跟踪 `.codex-screens/**` 与 `.codex/skills/animal-island-scene-first-one-shot-ui/**`，业务代码无已跟踪改动。
- `build`：通过。
- `lint`：通过。
- `test`：基线已有 2 个失败。

## 官方来源审计

- `animal-island-ui/package.json`：版本 `0.9.4`。
- `AI_USAGE.md`：确认核心组件 API。
- `dist/types/index.d.ts`：确认本地导出还包括 `Loading`、`Table`。
- `public/animal-island-ui/`：有 `content_bg_pc.jpg`、`home_bg.webp`、`menu_bg.svg`。

## Forbidden Files

未修改：

- `lib/home/**`
- `app/api/**`
- `tests/**`
- `package.json`
- `package-lock.json`
- `components/home/HomeResourcesProvider.tsx`

## 残留扫描

- `<button>`：0。
- `<a>`：0。
- 旧视觉骨架 `text-white|ui-tinted-|ui-ambient-|ui-button-|ui-card|ui-dialog|ui-sheet|ui-input|ui-soft-panel`：0。
- 旧页面骨架 `animal-page|animal-stage|app-main-scroll|app-main-inner`：0。
- deep import `animal-island-ui/dist`：0。
- 原生 `input`：5 处，均为功能 fallback。
