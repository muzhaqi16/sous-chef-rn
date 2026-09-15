# `sous-chef/no-hand-rolled-search`

Search a loaded list through filterByTerm, not a hand-rolled toLowerCase().includes().

## Reports

- Use filterByTerm / matchesTerm from #hooks/search/useLocalSearch for a list search, or searchUtils for the fuzzy variant. A hand-rolled filter re-decides what an empty term, a null field and whitespace mean.

## Use instead

`filterByTerm` / `matchesTerm` from `#hooks/search/useLocalSearch`, or `searchUtils` for fuzzy matching.

## Why

A hand-rolled filter decides for itself what an empty term, a null field and whitespace mean; nine lists each answered differently.

## Exempt

Test files (`**/__tests__/**`, `*.test.ts(x)`) and `.graphql` documents.

Source: [`eslint/plugin/rules/no-hand-rolled-search.js`](../../eslint/plugin/rules/no-hand-rolled-search.js) · spec: [`__tests__/lint/rules/no-hand-rolled-search.test.ts`](../../__tests__/lint/rules/no-hand-rolled-search.test.ts)
