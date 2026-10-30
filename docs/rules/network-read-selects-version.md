# `sous-chef/network-read-selects-version`

A selection on a type with a server `version` that reaches the network selects `version`.

## Reports

- A selection set on an object or interface type that has a `version` field, inside an operation or inside a fragment some operation spreads (at any depth), that selects no `version`: not directly, not in an inline fragment, and not through a spread. An aliased `version` doesn't count, because the guard reads the field by its own name.

## Use instead

Select `version` beside the row's other fields: `shoppingList(id: $id) { id version name }`. The autofix adds it on its own line before the first selection.

## Why

`answerOrderingLink` keeps the device's copy of a row when an answer carries an older `version` of it, so an answer that arrives out of order never replaces newer data. It can only judge a row whose answer carries `version`. The server raises `version` on every write.

## Exempt

A fragment no operation spreads. The cache writers pass such a fragment's generated document to `readFragment` / `writeFragment` from TypeScript, so it never reaches the network, and a local write must not state a version the server didn't give. Types without a `version` field are exempt too.

Source: [`eslint/plugin/rules/network-read-selects-version.js`](../../eslint/plugin/rules/network-read-selects-version.js) · spec: [`__tests__/lint/rules/network-read-selects-version.test.ts`](../../__tests__/lint/rules/network-read-selects-version.test.ts)
