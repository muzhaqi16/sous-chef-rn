# `sous-chef/no-legacy-shadow-props`

Shadows use boxShadow from a theme.shadows step, not the individual shadow\* properties.

## Reports

- Use CSS boxShadow syntax instead of individual shadow properties. See src/styles/listStyles.ts for the correct pattern.

## Use instead

Spread a step of `theme.shadows` (`...theme.shadows.md`), which is CSS `boxShadow`.

## Why

The shadow ramp is per theme — the geometry is shared, the ink is not — and `src/theme/foundations/shadows.ts` is the one place a shadow geometry is written.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-legacy-shadow-props.js`](../../eslint/plugin/rules/no-legacy-shadow-props.js) · spec: [`__tests__/lint/rules/no-legacy-shadow-props.test.ts`](../../__tests__/lint/rules/no-legacy-shadow-props.test.ts)
