# `sous-chef/no-shared-value-assignment`

Write a SharedValue with .set(), never by assigning .value.

## Reports

- Use .set() instead of .value assignment for SharedValues (React Compiler compatibility). If this is not a SharedValue, refactor to avoid .value mutation.

## Use instead

`progress.set(1)`.

## Why

Assigning `.value` mutates a captured object during render or in a callback the React Compiler memoizes; `.set()` is the compiler-safe write.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-shared-value-assignment.js`](../../eslint/plugin/rules/no-shared-value-assignment.js) · spec: [`__tests__/lint/rules/no-shared-value-assignment.test.ts`](../../__tests__/lint/rules/no-shared-value-assignment.test.ts)
