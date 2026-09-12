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

## The device identity

One value identifies this install to the server, and every surface presents it:
the `x-device-id` header, the socket's `connectionParams.deviceId`,
`registerDevice(input.deviceId)`, and the issue, exchange and revoke of a device
credential. No other module mints or persists one.

| | |
| --- | --- |
| Value | `device_` + uuid v4, minted once |
| Owner | `src/storage/deviceId.ts` |
| Durable copy | the keychain (`DEVICE_ID_SERVICE`), `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` |
| Fast copy | the MMKV `device_id` key, read synchronously |

**Two accessors, picked by whether the caller can wait.** `getDeviceId()` is
synchronous and read-only — it answers from the memo or the MMKV mirror and
never mints, so `authLink` and `wsLink` can call it inside the request path and
get `null` rather than an identity no later launch agrees with.
`ensureDeviceId()` is the async, single-flight resolver: mirror, then keychain,
then mint. Registration and the three device-credential operations use it,
because none of them can proceed without an identity.

**The keychain is authoritative, and a mint reaches it first.** The device
credential lives in the keychain and is BOUND to this value; on iOS a keychain
entry outlives an app deletion while MMKV does not, so an identity held only in
MMKV would let a surviving credential name a device the server has never seen —
refused as `AUTH_DEVICE_CREDENTIAL_INVALID`, and the enrolment silently dropped.
Android removes both together on uninstall, so there the two stay in step by
construction.

**Neither accessor touches the recovery store.** When the device key is
unavailable `initializeSecureStorage` opens the unencrypted recovery instance,
which `purgeRecoveryStorage` erases on the next healthy launch. `isStorageReady()`
is true for it, so the mirror is gated on `isRecoveryStorage()` as well:
`ensureDeviceId()` still serves the keychain's value during an outage, and
nothing is minted into a file that is about to be discarded.

**A superseded identifier's row is retired once.** An install carrying the
`device_fingerprint` key has a second server `Device` row whose push token no
other client path reaches. After a confirmed registration,
`retireLegacyDeviceRow` looks it up with `deviceByDeviceId` and soft-deletes it,
dropping the key only once the server confirms; any failure leaves the key so
the next launch retries.
