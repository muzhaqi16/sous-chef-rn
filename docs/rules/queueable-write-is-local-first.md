# `sous-chef/queueable-write-is-local-first`

A write the offline queue can take writes the cache first and says so.

## Reports

- A call to a mutation whose document is in `REPLAY_PREPARATIONS` that is not local-first — whether fired through `const [fire] = useMutation(XDocument)` or `client.mutate({ mutation: XDocument, … })`. A `useMutation` call is local-first when the hook's options set `context: { localFirst: true }` or the call's own `context` does. An options object passed by name (`fire(options)`) is followed to its `const`.
- A per-call `localFirst` on a `useMutation` whose options already set it (`redundantLocalFirst`), for any document.
- A per-call `context` OBJECT on such a hook (`contextDropsLocalFirst`): Apollo replaces the hook's context with it, so the marker is lost. The callback form `context: hookContext => ({ ...hookContext, key })` merges instead.
- A local-first call paired with an `optimisticResponse`, declared either on the call or on the `useMutation` hook.

The document names come from `src/apollo/offlineQueue/preparationRegistry.ts` itself, read with the TypeScript parser; the rule throws if that list comes back empty, so a refactor there cannot quietly switch it off.

## Why

`queueLink` queues a mutation when it carries `localFirst` **or** its operation is in `REPLAY_PREPARATIONS`. Such a write whose caller skips the local cache write is queued anyway, settles `queued`, and shows nothing: the sheet closes, the list keeps the old value, and a restart has nothing to restore. The quantity sheet shipped exactly that. `localFirst: true` is the house marker that the caller wrote the cache before firing.

The pairing is the opposite failure. A queued write completes at once with a null result, and Apollo drops the optimistic layer on completion — so the change flashes on screen and vanishes. Where the write is local-first, the cache write IS the optimistic update.

The marker sits on the hook because every call of a local-first mutate function is local-first. A per-call copy is noise, and a per-call `context` object is worse: `useMutation`'s execute merges options with `compact`, so the object replaces the hook's context and the call stops being queued. `src/apollo/__tests__/hookMutationContext.test.ts` pins that merge.

## Use instead

Mark the hook, write the cache, then fire:

```ts
const [fire] = useMutation(UpdatePantryItemQuantityDocument, {
  context: { localFirst: true },
});

writePantryItemQuantity(cache, id, next);
await fire({ variables });
```

`client.mutate` and a helper that fires a caller's mutate function (`createShoppingListRow`'s `send`) keep the marker on the call.

## Exempt

`src/apollo/offlineQueue/**` — the queue builds and replays these writes rather than calling them. Test files and `.graphql` documents, like every production rule.

Source: [`eslint/plugin/rules/queueable-write-is-local-first.js`](../../eslint/plugin/rules/queueable-write-is-local-first.js) · spec: [`__tests__/lint/rules/queueable-write-is-local-first.test.ts`](../../__tests__/lint/rules/queueable-write-is-local-first.test.ts)
