# Offline-First API Support — Request Guide

> **Round 1 ✅ Delivered · Round 2 ⏳ Pending.** The API team implemented and
> documented everything in §1–§3 below (round 1); §4 (recipe cook-logging &
> consumption) is the new round-2 request. The **authoritative contract for what's
> delivered lives in the API repo** —
> `sous-chef-api/docs/api/offline-sync.md` and `sous-chef-api/docs/api/subscriptions.md`
> — and supersedes this document. This file is kept as the original request record.
> Notable outcomes: recipe favorites are replayable by a client-minted id
> (converging via a `wasCreated`/`wasRemoved` **success** payload, not a
> `ConflictError`); `syncConvertExpiredToWaste` / `syncConvertExpiredBatchesToWaste`
> were added (so those become offline-capable); `adjustPantryItemWeight` stays
> online-only (no inventory ledger to key replay on, as expected); and
> `mealPlanEvents(homeId)` provides the meal-plan/template collaboration push.

> A request guide / expectations from the **mobile client** to the **API team**.
> It describes the *capabilities and guarantees* the client needs to make features
> fully offline-first — **not** a schema spec. How to implement these (field
> names, types, conflict semantics) is the API team's call, based on what aligns
> with the rest of the API. The goal is a shared agreement on the contract so both
> sides build to the same expectations.

## Context

The mobile client is **local-first**: when the API is unreachable (device offline
or API down), it writes the change to its local cache immediately and **queues**
the mutation, then **replays** it when connectivity returns. For that to be
correct, the mutations involved must be safe to replay and able to converge on the
same server state the client already showed the user.

Most of the app already works this way (shopping list, pantry). This guide lists
the remaining capabilities we'd like the API to offer so the rest of the app can
join the same model.

## The two guarantees we rely on

1. **Client-provided identity.** For a *create*, the client can mint a stable
   identifier and the API accepts it as the new record's identity. A replayed
   create then resolves to the **same** record instead of creating a duplicate.
   *(Already supported for creating shopping-list items and pantry items — we'd
   like the same treatment extended where noted below.)*

2. **Idempotent replay.** Replaying a mutation that already took effect should
   **converge cleanly** — i.e. succeed, or return a clearly-typed "already in that
   state" result the client can treat as converged — and never produce a duplicate
   or surface as a hard failure.

If a mutation can't offer both, the client keeps it online-only and disables it
while offline (an honest disabled state beats a thrown error).

## What we'd like, by capability

### 1. Recipe favorites — replayable favorite / unfavorite
- **Favorite:** accept a client-provided identity for the saved-favorite record so
  a queued favorite resolves to the same record on replay. A re-favorite (replay,
  or two devices) should **converge** — return the existing favorite or a typed
  "already favorited" result — rather than duplicate or error.
- **Unfavorite:** unfavoriting a recipe that is **not currently favorited** should
  **converge as success** (idempotent), so a replay after the favorite is already
  gone isn't reported as a failure.
- **Why:** lets the client fill the heart **and** update the saved list instantly
  offline, and have both converge exactly on reconnect. Today the client can only
  do this approximately (it falls back to a re-fetch to reconcile).

### 2. Online-only mutations that lack a replayable path
These currently have no safe offline replay, so the client **gates them behind an
"API unavailable" disabled state**. If the API can offer a replayable/idempotent
form (the way pantry quantity adjustments already replay), the client can make
them offline-capable too — otherwise they stay online-only and that's fine:
- pantry weight correction
- convert-expired-to-waste (single and batch)

### 3. Collaboration parity (push vs poll)
- Shared **meal-plan / template** changes are currently **poll-based** on the
  client, while pantry and shopping changes are **pushed** (subscription). A push
  channel for meal-plan/template collaboration would let the client stay in sync
  without polling and match the rest of the app.

## Round 2 — still pending

### 4. Recipe cook-logging & consumption — replayable
The client wants to log a recipe as **cooked** and **deduct the used ingredients
from the pantry** while offline. Today `markRecipeAsCooked` and
`confirmRecipeConsumption` have **no safe replay path** — they take no
client-provided idempotency key and have no `sync*` twin, so a re-sent
cook/consume would **create a duplicate cooking log and double-deduct the pantry**.

- We'd like the same **`operationId`-keyed idempotency** the pantry deltas
  (restock / consume / waste / adjust / convert-expired-to-waste) already use:
  a client-minted operation id carried on the action so a replay **applies at
  most once** and a re-send returns the current state.
- It needs to cover the whole unit — the pantry deductions **and** the cooking-log
  creation / cooked-count increment — applied together, exactly once.
- Outcome: the client can mark "cooked" + deduct ingredients optimistically
  offline and have it converge exactly on reconnect (mirroring how the pantry
  consume deltas already work). Until then the client gates these online-only.

## Pattern reference

The shopping-list and pantry **create** flows already implement guarantee #1: the
client mints the id, the server persists it as the record's primary key, and a
replay converges on that record. The pantry **delta** ops (restock/consume/etc.)
implement the `operationId`-keyed variant of guarantee #2. Recipe favorites
(round 1) and cook-logging (round 2) follow the same two patterns. Aligning on this
contract lets both teams build toward the same offline-first behavior.
