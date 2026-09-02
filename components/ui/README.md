# UI adapter boundary

`components/ui` is the project-facing visual adapter layer. V2 visible UI must also follow `docs/12-island-life-design-system.md`.

## Rules

1. Business screens prefer `App*` components over importing a third-party visual component directly.
2. `animal-island-ui` may be upgraded or supplemented, but external visual APIs are normalized here first.
3. External GitHub code with a different design language may contribute interaction/state/layout logic, not its color/shadow/button/card system.
4. V2 business pages use the approved `--life-*` tokens from `app/island-life-tokens.css`; do not create per-page palettes.
5. Life-specific presentation belongs in `components/life`; reusable cross-domain patterns graduate into `components/ui`.
6. `/ui-lab` is fake-data-only and must never write production facts or trigger Legacy Game settlement.

## Implemented V2 shared patterns

```text
AppPageShell       V2 page shell / title hierarchy
AppRoleSwitch      shared 我 / Ta segmented switch
AppRecordRow       compact factual record row
AppFeatureTile     Nest / secondary feature entry
AppNutritionBar    carbs / protein / fat / kcal summary bar
```

These patterns are the V2-UI1 foundation. They are not allowed to invent game reward semantics in the Life recorder.

## Approved token source

```text
app/island-life-tokens.css
```

The V2 palette is warm ivory/cream with mint/teal identity plus soft yellow/coral/light-blue accents. Large-area brown is not part of the V2 page language.

Legacy Game continues to use its existing visual tokens; V2 `--life-*` tokens intentionally coexist without forcing a visual rewrite of `/game`.

## Future component rule

Before creating a new visual component:

```text
existing App*
-> animal-island-ui capability
-> licensed same-language GitHub pattern
-> mature headless interaction
-> project-original component
```

If a new component is cross-domain and stable, place it here. If it is specific to mood/sleep/activity/nutrition/medicine/etc., keep it in that domain until the pattern proves reusable.
