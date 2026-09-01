# UI 迁移回退说明

本次没有 commit，也没有 push。需要回退时只回退本次改动文件即可。

## 本次改动文件

- `app/globals.css`
- `components/home/CoupleGrowthPanel.tsx`
- `components/home/DualMonthlyHeatmaps.tsx`
- `components/home/ExchangeShop.tsx`
- `components/home/HomeScreen.tsx`
- `components/ui/AppScene.tsx`
- `components/ui/index.ts`
- `docs/ui-migration-audit.md`
- `docs/ui-visual-source-ledger.md`
- `docs/ui-component-contract.md`
- `docs/ui-theme-adapter.md`
- `docs/ui-wrapper-migration-plan.md`
- `docs/ui-rollback-guide.md`
- `docs/ui-migration-report.md`

## 安全回退方式

不要使用 `git reset --hard` 或 `git clean -fd`。

确认没有用户并行修改这些文件后，按文件逐个恢复；新增文件 `components/ui/AppScene.tsx` 可在确认只来自本次迁移后删除。
