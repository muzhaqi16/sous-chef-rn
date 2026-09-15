# `sous-chef/no-optimistic-response-cast`

An optimisticResponse is built from the cache, not a cast { \_\_typename, … } literal.

## Reports

- Hand-rolled `{ __typename, id, ... } as TData['field']` shapes inside `optimisticResponse` write partial entities to the cache and break data-masking watchers (useFragment returns `complete: false` → phantom rows in lists). Read the current entity via `client.cache.readFragment(...)` (returning IGNORE when absent) and annotate the callback's return type as `Unmasked<TData>` so no cast is needed. See CLAUDE.md "Apollo Mutation Patterns" + `usePantryItemMutations.ts:updateItemMutation` for the pattern.

## Use instead

Read the entity with `cache.readFragment` (returning `IGNORE` when absent) and annotate the callback return type as `Unmasked<TData>`.

## Why

A cast partial entity is written to the cache incomplete, so `useFragment` consumers resolve `complete: false` and render nothing until the server answers.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-optimistic-response-cast.js`](../../eslint/plugin/rules/no-optimistic-response-cast.js) · spec: [`__tests__/lint/rules/no-optimistic-response-cast.test.ts`](../../__tests__/lint/rules/no-optimistic-response-cast.test.ts)
