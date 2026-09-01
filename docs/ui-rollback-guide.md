# UI Migration Rollback Guide

## Diff Checkpoints

| Checkpoint File | Phase | Created At | Status |
|---|---|---|---|
| `docs/.ui-migration-checkpoints/final-working-tree.patch` | final | migration run | created |
| `docs/.ui-migration-checkpoints/final-status.txt` | final | migration run | created |
| `docs/.ui-migration-checkpoints/final-diff-stat.txt` | final | migration run | created |

## Rollback Phase -1

Remove or edit only preflight sections in migration docs.

## Rollback Phase 0

Remove or edit only audit/baseline sections in migration docs.

## Rollback Phase 1

Revert selector renames in `app/globals.css` using the final patch as reference. Do not touch heatmap classes.

## Rollback Phase 2

Remove or revert only files under `components/ui/**` that were created by this migration.

## Rollback Phase 3 Batch

Revert the page-component wrapper substitutions in `components/home/**` using `docs/.ui-migration-checkpoints/final-working-tree.patch`.

## Rollback Residual Migration

If a residual migration causes a visual regression, revert only the affected component file and keep earlier successful wrapper files.

## Verification After Rollback

Run:

```bash
cmd /c npm run build
cmd /c npm run lint
cmd /c npm run test
```

The known baseline test failure may remain unless fixed separately.

## Files That Must Not Be Reverted

Do not revert or modify `lib/home/**`, `app/api/**`, `tests/**`, `package.json`, or `package-lock.json` as part of this UI rollback unless explicitly requested.

## How to Recover from Interrupted Migration

Inspect `git status --short`, compare with `final-working-tree.patch`, and revert only the interrupted batch files. Do not use `git reset --hard` or `git restore .`.
