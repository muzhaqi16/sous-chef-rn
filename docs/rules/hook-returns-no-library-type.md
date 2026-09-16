# `sous-chef/hook-returns-no-library-type`

A feature hook hands a screen no library type.

## Reports

An exported `use*` in a feature's `hooks/` whose return type — the type itself, or any property one level down — names `ApolloError`, `ApolloClient`, `ApolloCache`, `ApolloQueryResult`, `InMemoryCache`, `NetworkStatus`, `ObservableQuery`, `FetchResult`, `MutationResult`, `QueryResult` or `SubscriptionResult`.

The checker resolves the real return type, so an inferred one is reported as readily as an annotated one.

## Why

The import boundary keeps the data layer out of what renders. This is its other half: a hook can hold the client correctly and still hand a screen an `ApolloError` or a whole result object. The screen is then coupled to Apollo **by type while importing nothing**, so no import rule can see it — and the next Apollo major reaches the screen rather than stopping at the hook.

## Use instead

Plain values and callbacks:

- a resolved message rather than an `ApolloError` — `localizedErrorMessage(err, fallback)`
- a boolean rather than a `NetworkStatus`
- what `settleMutation` settled (`applied | queued | failed`) rather than a result object

## Exempt

Tests, `__mocks__` and generated files. A hook that is not exported cannot reach a screen and is not reported.

Source: [`eslint/plugin/rules/hook-returns-no-library-type.js`](../../eslint/plugin/rules/hook-returns-no-library-type.js) · spec: [`__tests__/lint/rules/hook-returns-no-library-type.test.ts`](../../__tests__/lint/rules/hook-returns-no-library-type.test.ts)
