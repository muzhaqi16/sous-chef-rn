# `sous-chef/local-write-is-deterministic`

A local write's `apply` and `commit` read only their write and the cache, and take a row away without `evict` or `gc`.

## Reports

Inside `apply` or `commit` in a feature's `offline/localWrites.ts`:

- `new Date`, `Date.*`, `generateEntityId`, `generateId`, `requirePlatform`, or a store read.
- `evict` or `gc`.

## Use instead

Read an outside value once in `capture` and take it from `write.inputs`. Hide a row with `cache.modify` and `DELETE`, or filter it from its lists.

## Why

`apply` re-runs whenever the server's data under it changes, and after a restart, so a value read inside it changes under the write. `evict` deletes only from a layer that owns the row, so in `apply` it leaves a row the server's data holds. Verified: `#apollo-an-optimistic-layer-copies-the-whole-entity`.

## Exempt

`capture`, which runs once when the write is made.
