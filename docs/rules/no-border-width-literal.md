# `sous-chef/no-border-width-literal`

Border widths come from theme.borderWidth, never a numeric literal.

## Reports

- Use a named step of `theme.borderWidth` (none | hairline | thin | medium | thick | heavy) rather than a literal. A literal is a width the theme cannot change, and it is what made 106 files each pick their own hairline.

## Use instead

A named step of `theme.borderWidth`: `none | hairline | thin | medium | thick | heavy`.

## Why

A literal is a width the theme cannot change, and border width is the one visual property that must not follow the density setting — which is what `theme.borderWidth` encodes.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-border-width-literal.js`](../../eslint/plugin/rules/no-border-width-literal.js) · spec: [`__tests__/lint/rules/no-border-width-literal.test.ts`](../../__tests__/lint/rules/no-border-width-literal.test.ts)
