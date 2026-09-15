# `sous-chef/no-as-const`

Let TypeScript infer literal types instead of asserting as const.

## Reports

- Avoid `as const` — let TypeScript infer literal types naturally. Use `as const` only for union type derivation or discriminated unions.

## Use instead

An explicit type or `satisfies` (`const STEPS = {…} satisfies Record<Step, string>`).

## Why

`as const` freezes a value into readonly literal types that then leak into every consumer; `satisfies` checks the shape and keeps inference.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-as-const.js`](../../eslint/plugin/rules/no-as-const.js) · spec: [`__tests__/lint/rules/no-as-const.test.ts`](../../__tests__/lint/rules/no-as-const.test.ts)
