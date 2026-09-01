# UI Migration Report

## Result

Partial Success

Full Success is blocked because automated visual screenshot verification was unavailable in this runtime, and the project test suite has a pre-existing failing test.

## Visual Delta + Wrapper Contract Remediation

- AppButton ref contract remediated with a safe host-query adapter to the inner `button`.
- AppInput ref contract remediated with a safe host-query adapter to the inner `input`.
- AppCard now uses `forwardRef` and resolves to the official Card inner `div`.
- AppCard `variant` remains project-only; only legal official Card `type` values are passed.
- `app-*` visual tokens were rewritten from pink glass to cream/parchment surfaces, warm brown borders, chunky shadows, and 3D game buttons.
- `docs/.ui-migration-checkpoints/` was removed from the working tree and added to `.gitignore`.

## Official Palette Alignment

- Re-aligned `app-*` visual tokens to guokaigdg/animal-island-ui `DESIGN_PROMPT.md`.
- Replaced over-yellow/wood-board styling with official warm parchment: `#f8f8f0`, `rgb(247, 243, 223)`, `#794f27`, `#725d42`, `#9f927d`, and `#c4b89e`.
- Restored official mint teal accent tokens: `#19c8b9`, `#3dd4c6`, `#11a89b`, and `#e6f9f6`.
- Button shadows now use official `#bdaea0`; input shadows use `#d4c9b4`; input focus uses `#ffcc00`.
- Product peach-pink remains for primary business actions and active bottom navigation.
- DataManagement residual cleanup completed: backdrop uses `AppDialogBackdrop`, file/checkbox inputs are native, `AppButtonLink` is native `<a>`, and `AppToast` defaults to `aria-live="polite"`.

## Official Asset Wiring

- Available local assets: `content_bg_pc.jpg`, `home_bg.webp`, `menu_bg.svg`.
- `body` now uses `url("/animal-island-ui/content_bg_pc.jpg") center / auto repeat` as the primary background.
- `home_bg.webp` is weakened to a decorative `body::before` overlay at `opacity: 0.07`.
- Handmade full-page radial/linear gradient backgrounds and visible grid texture were removed from `body`.
- `menu_bg.svg` is not globally wired in this pass.

## Branch Safety

- current branch: `feat/animal-island-ui-migration`
- commit: none
- push: none

## Baseline Verification

- build: pass
- lint: pass
- test: fail before migration, `tests/home/home-stat-service.test.ts:213`
- direct PowerShell `npm run build`: blocked by local ExecutionPolicy; verification used `cmd /c npm ...`.

## Final Verification

- build: pass
- lint: pass
- test: same single failure as baseline
- local HTTP smoke: `http://localhost:3000` returned 200
- visual desktop: not completed, Playwright module unavailable
- visual mobile: not completed, Playwright module unavailable

## Phases Completed

- Phase -1: completed
- Phase 0: completed
- Phase 1: completed
- Phase 2: completed
- Phase 3: completed with documented fallback
- Phase 4: partial, residual scan clean but screenshots unavailable
- Phase 5: completed

## Files Changed

- `app/globals.css`
- `components/ui/**`
- `components/home/CoupleGrowthPanel.tsx`
- `components/home/DataManagement.tsx`
- `components/home/DualMonthlyHeatmaps.tsx`
- `components/home/EncouragementQuote.tsx`
- `components/home/ExchangeShop.tsx`
- `components/home/GrowthLog.tsx`
- `components/home/HomeScreen.tsx`
- `components/home/PlayerHeatmap.tsx`
- `components/home/RecordTodaySettlement.tsx`
- `docs/ui-migration-audit.md`
- `docs/ui-theme-adapter.md`
- `docs/ui-component-contract.md`
- `docs/ui-wrapper-migration-plan.md`
- `docs/ui-rollback-guide.md`
- `docs/ui-migration-report.md`

## Wrapper Summary

Created project wrappers for buttons, link-buttons, cards, inputs, textareas, selects, modal/dialog structures, and toasts.

## Page Migration Summary

Business-page native buttons and inputs were migrated to wrappers. Toasts were split from dialog styling into `AppToast`. Old residual-scan classes were removed from page components.

## Residual Scan Results

- native button scan: pass
- native input/textarea/select scan: pass
- old button class scan: pass
- old card/input/dialog class scan: pass
- `<a>` link-button scan: pass

## Exception List

See `docs/ui-wrapper-migration-plan.md`.

## Heatmap Safety

Heatmap business logic and tests were not modified. Heatmap display classes were preserved.

## Animation Class Preservation

Existing animation and transition behavior was preserved.

## Font Strategy

Accepted animal-island-ui bundled font system.

## Smoke Test Results

- dev server start attempted: yes
- HTTP 200: yes
- interaction smoke checklist: not fully automated

## Visual Verification

Automated screenshot verification unavailable because the runtime could not import `playwright`.

## Rollback Instructions

Use `docs/.ui-migration-checkpoints/final-working-tree.patch` and revert only affected allowlisted files. Do not use destructive repo-wide rollback commands.

## Known Limitations

- Automated visual screenshots and full interaction smoke tests remain to be completed.
- animal-island-ui current type exports include `Loading` and `Table`, not documented by AI_USAGE.md.
- animal-island-ui Button/Input/Card package types do not expose direct `ref`; wrappers adapt refs through inner DOM lookup.
