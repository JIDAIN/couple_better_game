# UI Migration Audit

## Preflight Check Report

- animal-island-ui version: 0.9.4
- AI_USAGE.md: found
- dist/types/index.d.ts: found
- API consistency: 2 diff(s) found
  - `dist/types/index.d.ts` exports `Loading`, not listed in AI_USAGE v0.7.7.
  - `dist/types/index.d.ts` exports `Table`, not listed in AI_USAGE v0.7.7.
- style import in layout.tsx: OK
- components/ui exists before migration: no
- font strategy: A, accept animal-island-ui bundled fonts
- platform: win32
- branch: feat/animal-island-ui-migration
- PowerShell npm note: direct `npm run ...` is blocked by ExecutionPolicy; verification used `cmd /c npm ...`.

## Baseline Verification

- build: pass
- lint: pass
- test: fail before migration, unchanged after migration
- baseline failed test: `tests/home/home-stat-service.test.ts` expects `weekGemTotal` 20 and receives 0.
- dirty files before migration: none reported by `git status --short`, aside from user-level Git ignore permission warning.

## UI Element Audit

- Native buttons were found in `DataManagement`, `DualMonthlyHeatmaps`, `ExchangeShop`, `GrowthLog`, `HomeScreen`, and `RecordTodaySettlement`.
- Native inputs/textareas were found in `DataManagement`, `DualMonthlyHeatmaps`, `ExchangeShop`, `GrowthLog`, and `RecordTodaySettlement`.
- Old button classes were found across page components and `app/globals.css`.
- Old card/dialog/input classes were found across page components and `app/globals.css`.
- `<a>` link-button residual scan found no matches.

## Migration Decision

All safe business buttons and inputs were migrated to project wrappers. Semantic `section` / `article` card-like containers were kept as structural fallback with wrapper-token classes to avoid changing document semantics.
