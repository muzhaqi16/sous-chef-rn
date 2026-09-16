# `sous-chef/queueable-write-is-local-first`

A write the offline queue can take writes the cache first and says so.

## Reports

- A call to a mutation whose document is in `SYNC_REGISTRY` that does not pass `context: { localFirst: true }` — whether fired through `const [fire] = useMutation(XDocument)` or `client.mutate({ mutation: XDocument, … })`. An options object passed by name (`fire(options)`) is followed to its `const`.
- A call that pairs `localFirst: true` with an `optimisticResponse`, declared either on the call or on the `useMutation` hook.

The document names come from `src/apollo/offlineQueue/syncRegistry.ts` itself, read with the TypeScript parser; the rule throws if that list comes back empty, so a refactor there cannot quietly switch it off.

## Why

`queueLink` queues a mutation when it carries `localFirst` **or** its operation is in `SYNC_REGISTRY`. A sync-mapped write whose caller skips the local cache write is queued anyway, settles `queued`, and shows nothing: the sheet closes, the list keeps the old value, and a restart has nothing to restore. The quantity sheet shipped exactly that. `localFirst: true` is the house marker that the caller wrote the cache before firing.

The pairing is the opposite failure. A queued write completes at once with a null result, and Apollo drops the optimistic layer on completion — so the change flashes on screen and vanishes. Where the write is local-first, the cache write IS the optimistic update.

## Use instead

Write the cache, then fire:

```ts
writePantryItemQuantity(cache, id, next);
await fire({ variables, context: { localFirst: true } });
```

## Exempt

`src/apollo/offlineQueue/**` — the queue builds and replays these writes rather than calling them. Test files and `.graphql` documents, like every production rule.

Source: [`eslint/plugin/rules/queueable-write-is-local-first.js`](../../eslint/plugin/rules/queueable-write-is-local-first.js) · spec: [`__tests__/lint/rules/queueable-write-is-local-first.test.ts`](../../__tests__/lint/rules/queueable-write-is-local-first.test.ts)
