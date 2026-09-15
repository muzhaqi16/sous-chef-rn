# `sous-chef/no-raw-spacing`

Padding, margin and gap are spacing tokens, never a non-zero number.

## Reports

A non-zero number literal (negative included) as `padding*`, `margin*`, `gap`, `rowGap` or `columnGap`.

## Use instead

A `theme.spacing.*` step, or a named `theme.layout.*` step; arithmetic over tokens is fine (`theme.sizes.button.md + theme.spacing.sm`). The scale starts at optical steps (`'3xs'` 1, `'2xs'` 2, `'2xsPlus'` 3). A value the scale lacks is added to `src/theme/foundations/spacing.ts`, never written at the call site. `0` stays a literal.

## Why

`applyAppearance` multiplies `theme.spacing` and `theme.layout` by the density setting. A raw number stays put while everything around it scales, so compact and spacious layouts drift out of rhythm one hard-coded gap at a time.

## Exempt

`src/theme/**`, which defines the scale. Test files.

Source: [`eslint/plugin/rules/no-raw-spacing.js`](../../eslint/plugin/rules/no-raw-spacing.js) · spec: [`__tests__/lint/rules/no-raw-spacing.test.ts`](../../__tests__/lint/rules/no-raw-spacing.test.ts)
