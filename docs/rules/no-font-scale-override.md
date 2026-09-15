# `sous-chef/no-font-scale-override`

Never cap or disable font scaling per element.

## Reports

- The font-scale ceiling is global — `MAX_FONT_SCALE` in #/theme/foundations/type, applied in the `Text` atom as `theme.maxFontScaleMultiplier`. A per-element cap bounds the OS scale only, leaving its product with the app preference unbounded.
- Never disable font scaling — every role must respond to the OS text-size setting. If the layout cannot take the largest size, give the text room or fewer glyphs; the combined ceiling already bounds how far it grows.

## Use instead

The global ceiling: `MAX_FONT_SCALE`, applied by the `Text` atom as `theme.maxFontScaleMultiplier`.

## Why

The ceiling is the product of the OS text size and the app's own 0.9–1.3 preference. A per-element cap bounds the OS half only and leaves the product unbounded; disabling scaling ignores the OS setting entirely.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-font-scale-override.js`](../../eslint/plugin/rules/no-font-scale-override.js) · spec: [`__tests__/lint/rules/no-font-scale-override.test.ts`](../../__tests__/lint/rules/no-font-scale-override.test.ts)
