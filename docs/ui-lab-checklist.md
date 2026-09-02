# UI Lab review checklist

> Temporary V2-UI0 checklist. Remove or fold stable findings into long-term docs before final merge if it stops being useful.

## Mobile review

- [ ] 320-360px width: mood choices remain tappable and do not overflow.
- [ ] Sleep time inputs remain readable without horizontal scrolling.
- [ ] Activity input + add button do not squeeze text excessively.
- [ ] Nest feature tiles remain readable with long Chinese descriptions.
- [ ] AppScene decorations do not cover content.

## Visual language review

- [ ] Mood has the highest theme density but still reads as a standard single-choice control.
- [ ] Sleep is visually calm and does not look like a score card.
- [ ] Activity feels like notes/records, not a checklist or task KPI.
- [ ] Feature tiles feel like one island-life system, not four unrelated mini apps.
- [ ] No Legacy Game reward visual language leaks into Life patterns.

## Upgrade review

Before changing the lockfile to `animal-island-ui 1.8.x`:

- [ ] Button / Card / Input / Modal / Select wrappers compile.
- [ ] AppScene Card / Title / Divider / Footer render consistently.
- [ ] `/game` visual smoke check is clean.
- [ ] `/ui-lab` visual smoke check is clean.
- [ ] Test / Lint / Build are green.
