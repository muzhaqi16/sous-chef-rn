# `sous-chef/no-bare-in-memory-cache`

A suite using the Apollo mock provider builds its cache with makeCache().

## Reports

- Use makeCache() from **tests**/helpers/apolloMockProvider (or let renderWithApollo build it). A bare InMemoryCache has no type policies and no possibleTypes, so the suite exercises a cache the app never runs.

## Use instead

`makeCache()` from `#/test-utils/apolloMockProvider`, or let `renderWithApollo` build it.

## Why

A bare `InMemoryCache` has no type policies and no `possibleTypes`, so the suite exercises a cache the app never runs. Scoped to suites importing the helper: a link test wiring its own client is exercising the link.

## Exempt

Enabled for test files only.

Source: [`eslint/plugin/rules/no-bare-in-memory-cache.js`](../../eslint/plugin/rules/no-bare-in-memory-cache.js) · spec: [`__tests__/lint/rules/no-bare-in-memory-cache.test.ts`](../../__tests__/lint/rules/no-bare-in-memory-cache.test.ts)
