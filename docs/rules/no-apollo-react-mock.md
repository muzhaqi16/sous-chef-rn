# `sous-chef/no-apollo-react-mock`

Tests render through the Apollo mock provider instead of mocking @apollo/client/react.

## Reports

- Use renderHookWithApollo / renderWithApollo from **tests**/helpers/apolloMockProvider.tsx instead. Direct jest.mock of @apollo/client/react couples tests to operation names, bypasses the real cache, and breaks under refactors. See CLAUDE.md "Apollo Test Patterns" for the migration recipe + 7 gotchas.

## Use instead

`renderWithApollo` / `renderHookWithApollo` from `#/test-utils/apolloMockProvider`.

## Why

Mocking the hooks couples a test to operation names and bypasses the production cache the test exists to exercise.

## Exempt

`.graphql` documents. Applies to tests and production code alike.

Source: [`eslint/plugin/rules/no-apollo-react-mock.js`](../../eslint/plugin/rules/no-apollo-react-mock.js) · spec: [`__tests__/lint/rules/no-apollo-react-mock.test.ts`](../../__tests__/lint/rules/no-apollo-react-mock.test.ts)
