# `sous-chef/no-raw-color`

A colour is a theme token, never a hex, rgb() or named literal.

## Reports

- A string that is a hex colour (`'#fff'`), `rgb()`/`rgba()`/`hsl()`/`hsla()`, anywhere.
- A named colour (`'white'`, `'black'`, …) as the value of a `*color`/`*Color` property, prop or destructured default.

## Use instead

A token: `theme.colors.*` in a stylesheet, `<Icon tone="onScrim" />` for an icon, `colors.*` from `#/theme/foundations/colors` outside a component. Missing one? Add it under `src/theme/` — a per-scheme value in `themes.ts`, a scheme-independent one (artwork, a stored swatch, a ripple) in `foundations/colors.ts`.

- Over a photo, camera preview or scrim: `onScrim` for the foreground, `overlays.*` for the scrim, `onScrimSubtle` for a control's ground.
- On a fill: that fill's `on*` token (`onPrimary`), never white — the fill follows the user's accent.

## Why

A literal ignores the colour scheme and the user's accent override: `white` on a primary fill vanishes under a light accent, and a white wash over a card glares in dark mode.

## Exempt

`src/theme/**`, where colours are defined, and `src/config/appConfig.ts`, whose `branding.primaryColor` is the brand anchor `foundations/brand.ts` derives the palette from. Test files.

Source: [`eslint/plugin/rules/no-raw-color.js`](../../eslint/plugin/rules/no-raw-color.js) · spec: [`__tests__/lint/rules/no-raw-color.test.ts`](../../__tests__/lint/rules/no-raw-color.test.ts)
