# `sous-chef/selects-key-field-directly`

A selection set that spreads a fragment on a type with an `id` selects `id` itself.

## Reports

- A field or fragment selection on a type carrying `id` that contains a fragment spread and no `id` of its own — neither a direct `id` nor one inside an inline fragment. An aliased `id`, or another field aliased to `id`, does not count.

## Use instead

Select `id` beside the spread: `pantryItem(id: $id) { id ...ItemDetail_pantryItem }`. It is already fetched inside the fragment, so the operation's cost is unchanged.

## Why

Under `dataMasking` a named spread is hidden from the selection that holds it, which sees only its own fields plus `__typename`. An object selected only through a spread therefore reaches its consumer without `id`, and the first `cache.identify`, `useFragment` or `readFragment` on it throws `Missing field 'id' while extracting keyFields`. `@graphql-eslint/require-selections` follows the spread into the fragment and accepts the `id` it finds there, so it cannot see this.

## Exempt

Operation root selections and inline-fragment selection sets, where masking does not apply. Types without an `id` field.

Source: [`eslint/plugin/rules/selects-key-field-directly.js`](../../eslint/plugin/rules/selects-key-field-directly.js) · spec: [`__tests__/lint/rules/selects-key-field-directly.test.ts`](../../__tests__/lint/rules/selects-key-field-directly.test.ts)
