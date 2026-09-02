# UI adapter boundary

`components/ui` is the project-facing visual adapter layer.

Rules:

1. Business screens should prefer `App*` components over importing a third-party visual component directly.
2. `animal-island-ui` may be upgraded or supplemented, but external visual APIs should be normalized here first.
3. External GitHub code with a different design language may contribute interaction/state/layout logic, not its own color/shadow/button system.
4. Life-specific presentation belongs in `components/life`; reusable cross-domain patterns can graduate into `components/ui` after the visual behavior stabilizes in `/ui-lab`.
5. `/ui-lab` must never write production facts or trigger Legacy Game settlement.

Long-term visual rules: `docs/12-island-life-design-system.md`.
