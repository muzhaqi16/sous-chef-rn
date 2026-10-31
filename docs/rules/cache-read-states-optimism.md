# `sous-chef/cache-read-states-optimism`

A direct cache read states whether it sees pending writes.

## Reports

- `readFragment`, `readQuery` or `diff` with no `optimistic` option, or with options the rule cannot read.

## Use instead

`optimistic: true` for a read of what the person sees: a duplicate check, a total, a value a local write builds on. `optimistic: false` for a read whose result reaches the server data: a link's answer, which Apollo writes into the root, and a replay's preparation. The fix adds `true`.

## Why

A pending write is an optimistic layer over the server's data, and these calls default to the server's data alone, so a read with no option quietly misses it: a duplicate check adds a second row, a total leaves the pending line out. A read that feeds the root must not see a layer, or Apollo would store a guess as a server answer. Verified: `#apollo-an-optimistic-layer-copies-the-whole-entity`.

## Exempt

Test files and anything outside `src/`.
