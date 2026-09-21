# `sous-chef/on-fill-text-uses-its-token`

Text on a fill reads that fill's own `on*` token.

## Reports

- **`hardcodedWhite`** — a style whose `color` is a white literal (`#fff`, `white`, `rgb(255,255,255)`) in a file that paints any `theme.colors` fill.
- **`onTokenNotNamingItsFill`** — a style whose `backgroundColor` is one fill and whose `color` is an `on*` token named for a different one.

Fills checked: `primary`, `danger`, `error`, `success`, `warning`, `info`.

## Why

The foreground follows the fill's luminance, and the fill is user-overridable — so a hardcoded white is wrong for four of the seven pickable brand colours. There is no `colors.white`; text over a ground the theme does not paint (a photo, a camera preview, a dark scrim) reads `onScrim`.

The mis-paired token is the subtler half: it reads as correct because it *is* a token rather than a literal, and it inverts with whichever fill it is actually named for.

## Use instead

```ts
chip: { backgroundColor: theme.colors.primary },
chipText: { color: theme.colors.onPrimary },
```

## What stays in Jest

Two of the four ways this pairing breaks are not per-file, and remain in `__tests__/ui/onFillTextUsesItsToken.test.ts`: a shared `commonStyles` fill overridden locally under a shared foreground (split across two files, so neither half reads as wrong alone), and the contrast maths itself — every palette pair is checked against AA for normal text with `chroma`.

Source: [`eslint/plugin/rules/on-fill-text-uses-its-token.js`](../../eslint/plugin/rules/on-fill-text-uses-its-token.js) · spec: [`__tests__/lint/rules/on-fill-text-uses-its-token.test.ts`](../../__tests__/lint/rules/on-fill-text-uses-its-token.test.ts)
