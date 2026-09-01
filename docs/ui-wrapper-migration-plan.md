# UI Wrapper Migration Plan

## Wrapper Components

- `components/ui/AppButton.tsx`
- `components/ui/AppButtonLink.tsx`
- `components/ui/AppCard.tsx`
- `components/ui/AppInput.tsx`
- `components/ui/AppTextarea.tsx`
- `components/ui/AppSelect.tsx`
- `components/ui/AppDialog.tsx`
- `components/ui/AppToast.tsx`
- `components/ui/index.ts`

## Migration Batches

| Batch | Scope | Status | Verification |
|---|---|---|---|
| Phase -1 | Environment and package checks | Completed | package/type/style checks pass |
| Phase 0 | Baseline UI audit | Completed | build/lint pass, test baseline fail recorded |
| Phase 1 | Theme selector migration | Completed | build/lint pass |
| Phase 2 | Wrapper foundation | Completed | build/lint pass |
| Phase 3 | Page component migration | Completed with documented fallback | build/lint pass |
| Phase 4 | Residual scan and verification | Partial | residual scan clean, screenshots unavailable |
| Phase 5 | Documentation | Completed | docs generated |

## Completed Files

| File | Migrated Elements | Verification |
|---|---|---|
| `app/globals.css` | old residual-scan selectors renamed to `app-*` | build/lint |
| `components/home/DataManagement.tsx` | buttons, inputs, textarea, toasts | build/lint |
| `components/home/DualMonthlyHeatmaps.tsx` | buttons, date input | build/lint |
| `components/home/ExchangeShop.tsx` | buttons, inputs, textarea, toasts | build/lint |
| `components/home/GrowthLog.tsx` | buttons, compact inputs, toasts | build/lint |
| `components/home/HomeScreen.tsx` | nav/back buttons, page card tokens | build/lint |
| `components/home/RecordTodaySettlement.tsx` | buttons, inputs, toasts | build/lint |
| `components/home/CoupleGrowthPanel.tsx` | card token classes | build/lint |
| `components/home/EncouragementQuote.tsx` | card token classes | build/lint |
| `components/home/PlayerHeatmap.tsx` | card token classes | build/lint |

## Skipped Files

| File | Reason | Blocks Full Success |
|---|---|---|
| `lib/home/**` | forbidden by request | No |
| `tests/**` | forbidden by request | No |
| `package.json` / `package-lock.json` | forbidden by request | No |

## Exception List

| File | Element | Reason | Fallback Type | Blocks Full Success |
|---|---|---|---|---|
| `components/home/*` | semantic card-like `section` / `article` containers | preserving semantic tags is safer than forcing official `Card` div | non-blocking structural fallback | No |
| `components/home/*` | complex sheet/dialog shell | current animated sheet layout exceeds official Modal shape | non-blocking structural fallback | No |
| `components/ui/AppTextarea.tsx` | textarea | package has no textarea primitive | non-blocking native fallback | No |
| `components/ui/AppToast.tsx` | toast | package has no toast primitive | non-blocking native fallback | No |
| `components/ui/AppButton.tsx` / `AppInput.tsx` | ref forwarding | package types do not expose ref prop | non-blocking API limitation | No |
| Visual verification | automated screenshots | Playwright module unavailable in current runtime | verification limitation | Yes |

## Residual Scan Results

| Command | Result | Notes |
|---|---|---|
| `rg -n "<button|</button>" app components --glob "!components/ui/**"` | no matches | pass |
| `rg -n "<input|<textarea|<select" app components --glob "!components/ui/**"` | no matches | pass |
| old button class scan | no matches | pass |
| old card/input/dialog class scan | no matches | pass |
| `<a>` button scan | no matches | pass |

## Remaining Gaps

- Automated desktop/mobile screenshots were not produced because Playwright was unavailable.
- Full interactive smoke testing should be completed manually or with a browser automation runtime.

## Optional Enhancements

| Component | Priority | Effort | Recommended |
|---|---|---|---|
| Replace structural card fallbacks with richer AppCard composition | Medium | Medium | Later |
| Add a real AppToast backed by future package primitive | Low | Low | Later |
| Add browser automation dependency/runtime | Medium | Low | Yes |
