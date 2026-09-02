# V2 UI source map

> Temporary V2-UI0 research note. Stable rules belong in `docs/12-island-life-design-system.md`.

## Source roles

| Source | Reuse role | Do not copy blindly |
|---|---|---|
| `guokaigdg/animal-island-ui` | primitives, tokens, interaction components | Nintendo-like assets / any API not in installed version |
| `TIUCSIB/animal-island-blog` | timeline, empty state, popover, toast, stat patterns | whole CSS bundle |
| `AshleyCry/AnimalIslandNewTab` | settings sidebar, card composition, secondary app layout | browser-extension state/storage layer |
| `guowenju/portal-os` | app grid, hidden tools, spatial navigation | desktop/window metaphor on mobile primary flow |
| `CheapNightbot/our-days` | mood calendar state/date mapping | SaaS card styling |

## V2 page mapping

```text
Today
  mood       -> original Life pattern + project adapters
  sleep      -> current Input now; candidate TimePicker after 1.8 validation
  activity   -> timeline/list pattern

Food
  -> existing DailyMealsPanelCore

Calendar
  -> standard month model + project day cell; candidate DatePicker only for date picking

Nest
  -> AnimalIslandNewTab / PortalOS composition references

Medicine
  -> project inventory pattern; Tag / Drawer / Skeleton candidates after 1.8 validation

Weight
  -> neutral history / chart; island theme stays mainly in outer container
```
