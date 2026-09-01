# UI Theme Adapter

## Design Goal

Migrate the local MVP to an animal-island-ui backed visual system while preserving the existing product information architecture, heatmap semantics, and business behavior.

## Design Decision Record

- Pink/orange remains the primary action language because the product already uses a warm relationship/reward tone. animal-island-ui supplies the component backing and playful foundation.
- Official animal-island-ui palette alignment uses `DESIGN_PROMPT.md` tokens: warm parchment surfaces, mint teal accent, warm brown text, muted borders, light 3D shadows, and yellow input focus.
- The target is animal-island-ui backed, not inspired-only: Button, Input, Card, Select, and Modal wrappers import from package root.
- The current page information architecture is retained to avoid changing workflows during UI migration.
- Heatmap colors are protected because they encode settlement levels and exercise markers.
- Wrappers are preferred so future page migrations consume local project APIs instead of raw package APIs.
- Structural fallback is allowed for textarea, toast, and complex sheet/dialog shells where animal-island-ui has no exact primitive.
- Font strategy A is accepted: animal-island-ui bundled fonts are allowed to influence the app.

## Font Strategy

Use animal-island-ui bundled fonts via the existing `import "animal-island-ui/style"` in `app/layout.tsx`. No extra project-level font override was added.

## Token System

| Token | Value | Purpose |
|---|---|---|
| `--bg` | `#f8f8f0` | Official primary background |
| `--bg-soft` | `rgb(247, 243, 223)` | Official content parchment |
| `--primary` | `#ff8aa0` | Product peach-pink action accent |
| `--animal-accent` | `#19c8b9` | Official mint teal accent |
| `--animal-accent-hover` | `#3dd4c6` | Official mint hover |
| `--animal-accent-active` | `#11a89b` | Official mint active |
| `--focus-yellow` | `#ffcc00` | Official input focus |
| `--reward` | `#f5c31c` | Reward and coin accent |
| `--growth` | `#86d67a` | Growth accent |
| `--text-main` | `#794f27` | Official primary text |
| `--text-body` | `#725d42` | Official body text |
| `--text-muted` | `#9f927d` | Official secondary text |
| `--card-bg` | `rgb(247, 243, 223)` | Official card surface |
| `--card-border` | `#9f927d` | Official standard border |
| `--shadow-button` | `#bdaea0` | Official button bottom shadow |
| `--shadow-input` | `#d4c9b4` | Official input bottom shadow |
| `--radius-card` | `24px` | Official-like card surfaces |
| `--radius-control` | `18px` | Capsule controls |

## Legacy Token Mapping

| Old Token | New Token | Notes |
|---|---|---|
| `ui-button-primary` | `app-button--primary` | Used through `AppButton` |
| `ui-button-secondary` | `app-button--secondary` | Used through `AppButton` |
| `ui-button-ghost` | `app-button--ghost` | Used through `AppButton` |
| `ui-nav-button` | `app-button--nav` | Used through `AppButton` |
| `ui-card-*` | `app-card--*` | Wrapper-token class |
| `ui-sheet` | `app-dialog-shell` | Structural fallback |
| `ui-dialog` | `app-dialog` / `AppToast` | Dialog/toast split |
| `ui-input` | `app-input` | Used through `AppInput` / `AppTextarea` |

## Selector Strategy

Old `ui-*` selectors targeted by the migration skill residual scan were renamed to `app-*` selectors. Heatmap, chip, text, animation, and domain-specific selectors were preserved.

## Official Asset Wiring

The page background now uses the manually provided official asset:

```css
background:
  url("/animal-island-ui/content_bg_pc.jpg") center / auto repeat,
  #f8f8f0;
```

`home_bg.webp` is only used as a very low-opacity decorative layer on `body::before` with `opacity: 0.07`. `menu_bg.svg` is available in `public/animal-island-ui/` but is not applied globally in this pass.

Large handmade yellow/brown gradients, strong radial glows, and visible grid texture were removed from `body`; the page background is now driven by official assets and official warm parchment tokens.

## Button Styles

`AppButton` wraps animal-island-ui `Button` and maps project variants to legal package `type` / `danger` props.

Visual remediation keeps product peach-pink for primary actions, but uses official `#bdaea0` button bottom shadow and lighter warm-brown borders instead of dark wood shadows.

## ButtonLink Styles

`AppButtonLink` is available for link-button usage. No business `<a className="ui-button...">` residual was found.

## Card Styles

`AppCard` wraps animal-island-ui `Card`. Existing semantic containers use `app-card--*` fallback classes where changing the tag would be unsafe.

Cards now use official parchment backgrounds, 2px muted borders, radius around 20-28px, and light card shadows instead of translucent glass or thick wood-board shadows.

## Input Styles

`AppInput` wraps animal-island-ui `Input` and preserves controlled input props.

Inputs now use official `#f8f8f0` fill, `#c4b89e` border, `#d4c9b4` bottom shadow, and `#ffcc00` focus.

## Textarea Styles

`AppTextarea` is a native fallback because animal-island-ui does not provide textarea.

## Select Styles

`AppSelect` wraps controlled-only animal-island-ui `Select`. No safe page select migration was needed in this pass.

## Dialog Styles

Complex sheets use `app-dialog-shell` structural fallback. `AppModal` is available for simple confirm dialogs, with `typewriter={false}` by default.

## Toast Styles

Toast notifications were separated to `AppToast` and no longer use dialog naming in page components.

## Heatmap Protection

Heatmap business logic, classes for levels, and date-generation files were not modified.

## Animation Class Preservation

Existing animation classes such as `animate-card-breathe` and transition utilities were preserved.

## Compound Input Patterns

Compact input rows were renamed from `compact-field-input` to `app-compact-control` and still preserve inline unit suffixes.

## Relationship with animal-island-ui

Wrappers import only from package root. `animal-island-ui/style` remains imported once in `app/layout.tsx`.
