# `sous-chef/no-unused-use-unistyles`

useUnistyles() is called for its return value.

## Reports

- useUnistyles() called without using its return value has no effect. Destructure what you need: `const { theme } = useUnistyles()`.

## Use instead

`const { rt } = useUnistyles();` — and only for runtime metadata, never `theme.*`.

## Why

A bare `useUnistyles()` statement subscribes the component to every theme change and reads nothing.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-unused-use-unistyles.js`](../../eslint/plugin/rules/no-unused-use-unistyles.js) · spec: [`__tests__/lint/rules/no-unused-use-unistyles.test.ts`](../../__tests__/lint/rules/no-unused-use-unistyles.test.ts)
