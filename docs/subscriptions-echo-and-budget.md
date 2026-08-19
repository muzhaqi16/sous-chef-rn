# Subscriptions — echo suppression, budget, device identity

Three things about the subscription contract that are easy to get wrong and
cheap to state. The document-size rules live with their guard
(`__tests__/graphql/documentLimits.test.ts`); this covers the rest.

## Echo suppression keys on the device, never the user

What a client has already applied is its own mutation's response, and that
landed on exactly one device. So the question "should I skip this event" is
**"did this device cause it"**, and the field that answers it is
`originatorClientId` — the server echoes back the `x-device-id` the mutation
carried.

`actorUserId` answers a different question, "did this *account* cause it", and
using it costs you the multi-device case: a user signed in on a phone and a
tablet gets no updates between them. That was this client's behaviour until
2026-08; all four domain hooks skipped on `actorUserId === userId` while the
device id sat plumbed-but-unread.

`isSelfEcho()` (`src/services/subscriptions/isSelfEcho.ts`) is the single
implementation. It prefers the originator and falls back to `actorUserId` when
an envelope carries none, which covers background jobs and any request that went
out before `initializeDeviceId()` ran.

**Verify it end to end with `npm run check:echo`** (needs the local API up). It
subscribes as one device, writes as another, and reads the field off the wire —
which is why it does not need a second emulator, and why it is better evidence
than watching two screens. Its second mode,
`node scripts/check-subscription-echo.mjs --as-other-device`, writes once as a
foreign device so you can watch a real simulator react.

**`actorUserId` is not the subject of the event.** An admin removing you reports
the admin; a system-created row reports `null`. Do not read it as "who this
happened to", and treat `null` as "the system" if it ever reaches the UI. Nothing
in this client renders it today — the only reads are the self-echo checks.

## The budget is 40, and this client spends 6

Six streams, all mounted for the session: `NotificationEvents`, `UserEvents`,
`PantryEvents`, `MealPlanEvents`, `MyShoppingListsEvents`, `HomeEvents`. The cap
is per user and **cluster-wide across every device**, so the number that matters
is 6 × devices, plus up to one un-reaped generation per device mid-reconnect:
3 devices ≈ 36 against 40.

**The three scoped streams follow the *selected* home / pantry, not every home
the user belongs to** — `pantryEvents(selectedPantryId)`,
`homeEvents(selectedHomeId)`, `mealPlanEvents(selectedHomeId)`. Switching homes
swaps a subscription rather than adding one, which is what keeps the count flat
at 6 for a user in ten homes. Fanning any of them out per home would multiply
the whole budget, so measure before doing it.

`SUBSCRIPTION_LIMIT_EXCEEDED` is a **capacity** condition, not a document
defect: the connection stays open and only the over-limit operation is refused,
and it frees up as other devices disconnect. It must stay retryable — it is
deliberately excluded from `PERMANENT_REJECTION_CODES` in
`src/utils/subscriptionErrorHandler.ts`, which is the list that permanently
disables a stream.

## Two device ids, and the open question

They are different values for the same phone:

| | Value | Used for |
| --- | --- | --- |
| `getDeviceId()` (`src/utils/deviceId.ts`) | `device_` + uuid v4, minted once and persisted to MMKV | `x-device-id` header, WS `connectionParams.deviceId` — echo attribution and connection supersession |
| `deviceInfo.deviceId` (`src/utils/deviceInfo.ts`) | `generateDeviceFingerprint()` — a hash over hardware identifiers | `registerDevice(input.deviceId)` — the persisted `Device` row behind push |

Nothing forces them to match and today they don't. Using one id for both would
line push/device management up with echo suppression, and the persisted uuid is
the better candidate of the two: it is synchronous (the header is set in
`authLink`'s hot path, where the fingerprint's `await` cannot go) and it is not
a hardware fingerprint.

**Not changed, deliberately.** `registerDevice` keys push delivery, so switching
its id re-registers every existing install as a new device and strands the old
row's push token. That is an outward-facing migration, not a refactor — it needs
a deliberate decision and probably a backfill.
