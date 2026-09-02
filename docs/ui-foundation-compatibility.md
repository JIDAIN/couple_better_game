# V2-UI0 compatibility matrix

> Temporary implementation note for `v2/ui-foundation`. Stable rules live in `docs/12-island-life-design-system.md`.

## Current baseline

```text
package.json: animal-island-ui ^1.0.1
package-lock: animal-island-ui 1.0.1
upstream reviewed: animal-island-ui 1.8.x
```

The current application adapters already isolate most direct library usage behind `components/ui/App*`.

## Existing wrapper compatibility

| Project wrapper / use | 1.8 upstream API reviewed | Assessment |
|---|---|---|
| `AppButton` -> `Button` | `type / size / danger / ghost / block / loading / htmlType` still exist | low risk |
| `AppCard` -> `Card` | `type / color / pattern` still exist; 1.8 adds `hoverable` | low risk |
| `AppInput` -> `Input` | native input props + `size` still exist; 1.8 adds clear/status/shadow behavior | low risk |
| `AppModal` -> `Modal` | export remains available | verify visually |
| `AppSelect` -> `Select` | export and `SelectProps` remain available | verify interaction |
| `AppIcon` / `AppGameIcon` -> `Icon` | `Icon / IconName` exports remain | verify icon inventory |
| `AppScene*` -> `Card / Divider / Footer / Title` | all exports and type families remain | low risk, visual regression required |
| global `Cursor` | export remains | low risk |

## New 1.8 capabilities worth considering

Priority A — likely useful soon:

```text
TimePicker   -> Sleep UI
DatePicker   -> calendar/date editing
Drawer       -> mobile secondary panels / 小窝
Tag          -> medicine states / filters
Skeleton     -> life/food/medicine loading states
Notification -> save/update feedback
```

Priority B — evaluate when feature arrives:

```text
Tabs         -> medicine / weight secondary views
Table        -> desktop medicine inventory only; mobile should not default to table
Image        -> diary/message attachments if added later
Carousel     -> only if a real product need appears
Progress     -> avoid in life recorder unless it represents neutral progress, not performance scoring
```

Not a reason to upgrade by itself:

```text
Wallet / Countdown / Phone / BackTop
```

Legacy Game may continue using its existing visual behavior; V2 should not consume reward-oriented components merely because they exist.

## Upgrade gate

Do not change the lockfile to 1.8.x until all are true:

- current `App*` compile against the candidate version;
- `npm run test`, `npm run lint`, `npm run build` pass;
- `/game` receives a visual smoke check;
- `/ui-lab` receives a mobile-width visual check;
- Button/Card/Input/Modal/Select/Scene have no unexpected visual regression;
- upgrade is isolated from V2 business/API work.

After the version upgrade is validated, fold the stable findings into `docs/06-ui-guidelines.md` / `docs/12-island-life-design-system.md` and remove this temporary note.
