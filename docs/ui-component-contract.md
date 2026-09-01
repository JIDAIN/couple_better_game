# UI Component Contract

## AppButton API

Wraps animal-island-ui `Button`. Supported project variants: `primary`, `secondary`, `ghost`, `danger`, `nav`, `tab`, `plain`. `type` maps to animal `htmlType`.

## AppButtonLink API

Wraps Next.js `Link` with project button styling. Use for link-buttons only.

## AppCard API

Wraps animal-island-ui `Card`. Supported project variants: `default`, `soft`, `hero`, `main`, `compact`, `item`, `panel`.

## AppInput API

Wraps animal-island-ui `Input`. Preserves standard input props, controlled values, `inputMode`, and `onChange`.

## AppTextarea API

Native textarea fallback. Allowed because animal-island-ui has no textarea primitive.

## AppSelect API

Wraps animal-island-ui `Select`; `options`, `value`, and `onChange` are required.

## AppModal API

Wraps animal-island-ui `Modal`; `typewriter` defaults to `false` for business modals.

## AppDialog Structure API

`AppDialogShell`, `AppDialogHeader`, `AppDialogBody`, `AppDialogFooter`, and `AppDialogBackdrop` are structural fallback wrappers for complex sheet layouts.

## AppToast API

Toast status surface. Use only for transient notifications, not confirmations.

## Variant Mapping

| Wrapper | Project Variant | animal-island-ui Backing |
|---|---|---|
| AppButton | primary | Button `type="primary"` |
| AppButton | secondary/nav/tab | Button `type="default"` |
| AppButton | ghost/plain | Button `type="text"` |
| AppButton | danger | Button `type="primary" danger` |
| AppInput | all | Input |
| AppCard | all | Card |
| AppModal | all | Modal |

## Ref Support

| Wrapper | Ref Type | Required |
|---|---|---|
| AppButton | `HTMLButtonElement` via host query adapter | Yes |
| AppInput | `HTMLInputElement` via host query adapter | Yes |
| AppCard | `HTMLDivElement` via host query adapter | Yes |
| AppTextarea | `HTMLTextAreaElement` | Yes |

animal-island-ui `Button`, `Input`, and `Card` are currently exported as `React.FC` and do not expose typed `ref` props. The project wrappers therefore keep using the official components, but resolve refs through a `display: contents` host and `useImperativeHandle` to the real inner DOM node.

## Special Input Type Exceptions

| Type | Handler | Status |
|---|---|---|
| `date` | AppInput | Migrated |
| `datetime-local` | AppInput | Migrated |
| `file` | AppInput hidden file picker | Migrated, smoke-test recommended |

## Fallback Rules

Use fallback only when the official package lacks the exact primitive or the existing semantic tag should not be changed.

## Visual Delta Remediation

The `app-*` contract now owns a visibly animal-island-ui-like visual layer: warm cream backgrounds, 2px brown borders, chunky card radius, thicker warm shadows, 3D button press states, cream inputs, and warm focus rings.

## Blocking vs Non-blocking Fallback

Structural card/sheet fallback is non-blocking when it preserves semantics and is documented. Missing automated screenshot verification blocks Full Success for this run.

## Forbidden Usage

Do not use native business buttons or old residual-scan `ui-*` classes in page components. Do not import animal-island-ui from deep paths.
