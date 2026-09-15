# `sous-chef/no-combined-unistyles`

One element takes one Unistyles style; combine through variants.

## Reports

- Avoid combining multiple `styles.*` on the same element — Unistyles v3 proxies break when spread by reanimated's StyleSheet.flatten(). Use `styles.useVariants()` instead.

## Use instead

`styles.useVariants({ … })` with a single `styles.x`, plus a caller style: `style={[styles.x, callerStyle]}`.

## Why

Unistyles 3 styles are proxies; two of them spread through reanimated's `StyleSheet.flatten()` lose their native binding.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-combined-unistyles.js`](../../eslint/plugin/rules/no-combined-unistyles.js) · spec: [`__tests__/lint/rules/no-combined-unistyles.test.ts`](../../__tests__/lint/rules/no-combined-unistyles.test.ts)
