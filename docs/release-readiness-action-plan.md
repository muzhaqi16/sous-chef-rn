# Release Readiness Action Plan — PR #166 (dev → main)

Date: 2026-07-12. Scope: full review of the dev → main release PR (327 files, +22,721/−7,328; offline-first mutations, notifications/push stack, API/schema alignment, react-navigation 8 + unistyles 3.3 upgrades). Reviewed across six dimensions: offline queue & mutation correctness, notifications/push, GraphQL/Apollo patterns, CLAUDE.md conventions, duplication/reuse, dependencies/release readiness. The two P0 findings and the top cache finding were re-verified first-hand in the code.

## Verdict

**Not ready to merge as-is.** Two blockers (one iOS push, one offline-sync) and six high-priority items should land first. Everything else can ship as fast-follows. The codebase itself is in strong shape: zero hard convention violations, zero schema drift, green typecheck/lint/tests.

## Verification baseline (2026-07-12)

- `npm run typecheck` — pass.
- `npm run lint` — 0 errors, 3 warnings (deprecated RNFB `requestPermission`/`AuthorizationStatus` in `src/services/push/nativePushProvider.ts` — see P3).
- `npm test` — 554 suites / 6,425 tests pass (~90s). Jest force-exits on a leaked handle (known pre-existing backlog item).
- **Caveat:** this machine's `node_modules` is stale vs the lockfile (@react-navigation installed at alpha.16/.19 vs pinned alpha.35/.41/.42). Run `npm ci` and re-run the suite before release validation.

---

## P0 — Blockers (fix before merging)

> **Status 2026-07-12: both P0 items addressed** via OpenSpec change `openspec/changes/fix-p0-release-blockers/` (specs + design + tasks). P0-1: native one-shot wrapper + 20s failsafe in `PushNotificationForwarder.m`; verified by Debug build + simulator `content-available` push smoke (app alive past the failsafe window, no crash/watchdog). P0-2: `getPendingClientIds()` now collects `input.items[].id`; 5 new `queueStore.test.ts` cases; full gate green on `npm ci`-fresh `node_modules` (554 suites / 6,430 tests). Remaining from that change's checklist: physical-device killed-app push smoke and the on-device offline-add smoke (checklist items 2–4 below).

### 1. iOS background-push completion handler leaks whenever JS listeners aren't attached yet

`ios/SousChef/AppDelegate.swift:84-93` → `PushNotificationForwarder` → RNCPushNotificationIOS, whose NSNotification is only observed once the first JS `'notification'` listener attaches — and that listener registers inside a React effect (`src/services/push/iosPushMessaging.ts:42-48` via `useNotifications`, gated behind MMKV hydration/SplashScreen). A `content-available` push that launches the killed app (now enabled by `UIBackgroundModes: remote-notification`), or any push during the launch/hydration window, posts to zero observers: the event is dropped **and the completion handler is never invoked** → iOS watchdogs the app (~30s) and progressively deprioritizes background delivery for the bundle.
**Fix:** complete natively — have `PushNotificationForwarder` invoke the handler (`.noData`) itself when the bridge/listeners aren't up (flag or timeout), or register the JS `'notification'` listener at the `index.js` entry point instead of inside a React effect.

### 2. Offline shopping-list adds lose their pending-edge guard (batch input shape invisible to `getPendingClientIds`)

`src/apollo/offlineQueue/queueStore.ts:274-291` reads only `input.id ?? input.itemId ?? id`. The PR migrated every single-item add to the batch shape `input: { shoppingListId, items: [{ id: generateEntityId(), … }] }` (`useAddShoppingItem.ts:151`, `AddEditItem.tsx`, `FilteredPantryItems.tsx`, `usePantryItemDetailActions.ts`, barcode `SearchResults.tsx`) and updated `queueManager.getEntityId` (`queueManager.ts:536`) — but not `getPendingClientIds`. Queued offline adds therefore contribute no pending client id, so the `itemsConnectionFieldPolicy` merge guard (`src/apollo/cache.ts:376-397`) never protects the un-replayed create. Add an item offline → reconnect with the list on screen → the cache-and-network first-page refetch lands before the serial queue drains → the optimistic edge is dropped and the item stays invisible until a manual refresh (replays run no `update` callback).
**Fix:** collect every `variables.input.items[].id` in `getPendingClientIds` (multi-item batches exist via `useRecipeShoppingList`); add a `queueStore.test.ts` case for the batch shape; consider having `getEntityId` collect all item ids so a failed multi-item add doesn't strand items 2..n.

---

## P1 — High (fix before release; small, targeted changes)

> **Status 2026-07-12: all six P1 items addressed** via OpenSpec change `openspec/changes/fix-p1-release-highs/`. P1-3: native one-shot tap cache + `InitialNotificationTap` JS pull (co-located in PushNotificationForwarder.m); P1-4: NavigationService single-slot pending navigation flushed on container `onReady`; P1-5: restored-session `registerDeviceInBackground()` from `useStartupInit`; P1-6: `keyArgs: ['filters']` + cache tests; P1-7: `resetProcessingToPending` at drain start; P1-8: `clearPersistedOptimisticFields` on replay success/convergence. Full gate green (typecheck/lint/6,451 tests), iOS build succeeded. Runtime-verified in the simulator (Detox + CDP): cold-launch tap with category SHOPPING routes to the Shopping List and does not replay on the next launch (one-shot); restored-session cold start fires `RegisterDevice` (observed via Apollo console-link, 50ms); all four tabs render under the new recipes keyArgs (ui-tour pass); regression test kept at `e2e/tests/p1-cold-tap.e2e.ts`. Remaining device-only: real-APNs killed-app delivery/watchdog behavior (checklist item 2). P1-7/P1-8 are unit-verified only (kill-timing fault injection has no sim surface).

3. **iOS cold-start notification tap is dead on both paths.** Tap-launch delivery is dropped pre-listener (same root as P0-1), and the `getInitialNotification()` fallback reads `launchOptions`, which isn't populated for tap-launches once a `UNUserNotificationCenterDelegate` is set. Cache the initial `UNNotificationResponse` in `PushNotificationForwarder` and re-emit/expose it once JS is ready. (`src/services/push/iosPushMessaging.ts:50-56`, `AppDelegate.swift:92-100`)
4. **Notifee cold-launch tap silently dropped.** `setupNotificationHandlers()` receives the buffered PRESS long before `navigationRef.isReady()`; `NavigationService.navigate` silently no-ops. This is the primary Android tap path. Queue the pending navigation in `NavigationService` until `onReady`. (`src/utils/notifications/localNotificationHelper.ts:109-122`, `src/services/NavigationService.ts:13-16`)
5. **Keychain-restored sessions never re-register push.** `registerDeviceInBackground()` runs only on explicit login/settings opt-in (`src/services/authService.ts:518`), so token rotations are never sent and iOS never re-registers that session — pushes silently die until the next manual login. Run it on cold start when a valid session + granted permission exist.
6. **Stale `Query.recipes` keyArgs → cache corruption once filters are used.** `src/apollo/cache.ts:803` still keys on `['category','difficulty']` but the operation now passes `filters: {…}` — keyArgs match nothing, so all `recipes(...)` variants share one cache entry. Latent today; the first filtered caller gets cross-contaminated or wiped lists. One-line fix: `keyArgs: ['filters']`.
7. **App kill mid-replay strands the op in PROCESSING forever** (pre-existing, but core to this release's offline promise). Nothing resets stale `PROCESSING` entries; they're also excluded from `getPendingClientIds`, so the optimistic edge gets dropped too — silent data loss. Reset stale PROCESSING → PENDING at drain start (replays are idempotent by design). (`src/apollo/offlineQueue/queueManager.ts:213-216`)
8. **Persisted optimistic fields are never cleared after a successful replay** (pre-existing pattern; exposure widened by this PR's new persisted fields). Entries live in MMKV forever and `useOptimisticDataRestoration` re-applies them on every tab mount — a housemate's later change gets visually reverted on each mount. Clear entries on replay success in `queueManager.processMutation` (reuse `extractEntityInfo`) and/or add a TTL. (`src/apollo/offline/OptimisticDataPersistence.ts`, `useOptimisticDataRestoration.ts:64-89`)

---

## P2 — Medium (strongly recommended; PR or first patch release)

> **Status 2026-07-13: 11 of 12 P2 items resolved** (all code-side; only on-device/build verification remains) via OpenSpec change `openspec/changes/fix-p2-release-mediums/`. Done (client-side, full gate green — typecheck/lint/556 suites/6462 tests): P2-9 (shared `preservePendingEdges` guard now also backs `mergeConnectionByNodeId`), P2-17 (favorite id reconciliation via new generic `adoptServerEntityId` + `savedDetails` re-point), P2-18 (terminal-first queue eviction + typed `QueueCapacityError`), P2-11 (logout deregisters the device via `updateDevice(delete:true)` — the schema's documented replacement for `deleteDevice` — unsubscribes the refresh listener, resets notifications), P2-12 (badge sync gated on `isHydrated`), P2-13 (getToken re-check after the refresh listener subscribes), P2-10 (recipes op renamed `AddItemsToShoppingListFromRecipe` + codegen), P2-14 (Android release/bundle build throws without `google-services.json`), P2-19 (all six `@react-navigation/*` prereleases exact-pinned; lockfile resolved versions unchanged). P2-15 (meal-completion idempotency) resolved as **already gated** — backend confirmed the deduction is gated on the `false → true` completion transition via a live pre-update read, so a sequential offline-queue replay never double-deducts ([api#178](https://github.com/muzhaqi16/sous-chef-api/issues/178), closed); documented in `useMealPlanItemActions`, no schema change. P2-16 (offline bulk clear) resolved — backend added a batch `removeItemsFromShoppingList(input: { ids, shoppingListId })` mutation ([api#177](https://github.com/muzhaqi16/sous-chef-api/issues/177)); `useClearShoppingListItems` now replays the exact captured ids and the dead `DeleteShoppingListItems` client op was removed. **All 11 code-side P2 items are landed** (only P2-20 — on-device theme regression — plus the Android release-build failure (5.3) and offline/logout/badge device smokes (checklist items 3–7) remain as on-device/build verification, no code).

9. **`mergeConnectionByNodeId` first-page replace lacks the pending-ids guard** the other two merge strategies have (`src/apollo/cache.ts:226-233`) — offline-created meal templates / favorites transiently vanish on reconnect refetch. Two reviewers independently converged on this. Port the guard.
10. **Duplicate operation name `AddItemsToShoppingList`** in `useRecipeDetail.graphql:5` and `shoppingList.graphql:1048` — tolerated only while textually identical; the repo's own comments document this exact failure mode. Rename the recipes copy (`AddItemsToShoppingListFromRecipe`) + `npm run codegen`.
11. **Logout leaves the previous user's push/notification state live**: no server-side token unregistration, `resetNotifications` has zero callers, persisted inbox/badge survive (shared-device leak; inbox persistence itself is pre-existing). Call `resetNotifications()`, unsubscribe the refresh listener, and null the server token in `logout()`. (`authService.ts:721-752`, `resetManager.ts`, `notificationSlice.ts:584`)
12. **Badge stomped to 0 at every JS start** — `badgeSync` subscribes with `fireImmediately: true` at import time with pre-hydration `unreadCount = 0`, including background/headless launches. Gate on hydration; optionally reconcile from the push payload. (`src/utils/notifications/badgeSync.ts:27-30`)
13. **`getToken` timeout dead window**: a token arriving after the 10s timeout but before the refresh listener subscribes is cached but never sent. After subscribing, re-check `getToken()` and `updateDevice` if a token materialized. (`iosPushProvider.ts:87`, `authService.ts:274-300`)
14. **Android release can silently ship without FCM** — the google-services plugin applies only if the (gitignored) file exists; a misconfigured CI release builds fine with push entirely dead. Fail the `release` build when the file is missing. (`android/app/build.gradle:174-180`)
15. **Meal-completion pantry deduction has no idempotency key** — every other ledger op got one this PR; a lost-response replay can double-deduct unless the server transition-gates. Verify server behavior; if not gated, add `idempotencyKey` to `UpdateMealPlanItemInput`. (`useMealPlanItemActions.ts:310-327`)
16. **Offline bulk clear replays a filter, not ids** — replay deletes purchased items other members added after the user queued the clear. Send the `itemIds` the hook already computes. (`useClearShoppingListItems.ts:74`)
17. **Favorite client-id → server-id never reconciled** when the server resolves to an existing SavedRecipe (already favorited elsewhere): duplicate saved-list rows + phantom entity until a full refetch. Evict the optimistic edge whose `recipe.id` matches but SavedRecipe id differs, mirroring `reconcileShoppingItemCreateUpdate`. (`useRecipePreload.ts:196-226`)
18. **Queue cap silently drops the oldest PENDING op** at 100 entries, breaking create→update dependency chains. Evict terminal (SUCCESS/FAILED) entries first; if 100 PENDING, reject the enqueue with an honest "too many unsynced changes" error. (`queueStore.ts:191-194`)
19. **Pin the five @react-navigation alphas exactly** (drop `^`) — `^8.0.0-alpha.35` semver-matches a future `8.0.0-beta`/`8.0.0`, which will require the next react-native-screens major and gesture-handler 3.x. `npm ci` is safe today; any fresh resolution silently jumps channels. (`package.json:102-106`)
20. **On-device theme regression pass for `inactiveBehavior: 'pause'`** — the entire theme-propagation-to-paused-screens path rests on unistyles 3.3.0 (published 2 days ago) + nav alphas (4 days old). Switch theme with a stacked detail screen open + all tabs mounted, navigate back through each, both platforms. Keep re-adding `'none'` documented as the one-line rollback.

---

## P3 — Low / hygiene (cheap ones are worth doing in this PR)

- Delete orphaned `src/features/pantry/hooks/mutations/useOpenPantryItem.generated.ts` (untracked local orphan; codegen has no cleanup step).
- Fix stale shared-fragment header in `src/features/recipes/graphql/recipeFragments.graphql:57-58` (still lists deleted `SuggestedRecipes`, renamed `FavoriteRecipe`; missing new `ForkRecipe`). The header is the shared-fragment contract per CLAUDE.md.
- Stale comments (both files already in the diff): `InvitationAcceptanceModal.test.tsx:138` describes `refetchQueries` the component no longer uses; `ShoppingListMainContent.tsx:65` claims a `React.memo` that exists nowhere in `src/`.
- Add a CLAUDE.md footnote sanctioning `Unmasked<>` in `src/apollo/utils/cacheUpdaters.ts` (`applyOptimisticFragmentPatch`) — it's justified infrastructure, but it silently widens the "optimisticResponse-only" rule.
- Initial text search lacks the stale-response guard `loadMoreSearch` has — two rapid searches can interleave and the stale one wins. (`useRecipeScreen.tsx:338-390`)
- Route `ConflictError` through the new `alertVersionConflict` Refresh UX in the shared rejected-branches (e.g. `recordPurchase`), not just `useCrudOperations`.
- Auth-refresh-succeeded + API-unavailable-during-backoff permanently fails the op instead of deferring — treat like network/server deferral. (`queueManager.ts:420-449`)
- Old-build persisted queue entries (idempotency in `context.operationId`) replay without dedup post-upgrade — accept the narrow window or add a one-time migration injecting `input.idempotencyKey`.
- `GetUnreadNotifications` unreadOnly connection can retain read notifications between replace-refetches (bounded; badge is server-authoritative) — add a consumer-side `readAt` filter or a comment.
- `toggleItem` returns `false` for a successfully queued offline toggle — misleading contract (currently no caller reads it).
- RNFB deprecated `requestPermission`/`AuthorizationStatus` (the 3 lint warnings) — plan the migration (react-native-permissions or notifee) before the next RNFB major.
- Schedule the gesture-handler 3.x migration before nav v8 beta forces it (2.30.0 works with today's alphas; v8 docs list 3.0 as the minimum).
- `useNotificationListener` remount would leak the one-slot RNC emitter subscription — fragile, single mount today.
- Login registration ignores the server `pushEnabled` preference (`acquirePushToken()` called without options) — correctness currently depends on server-side send gating.
- FCM background handler bypasses quiet-hours/type filters — correct only if the server suppresses sends during quiet hours (comments claim it does; confirm server-side).

---

## Pre-submit release validation checklist

1. `npm ci`, then re-run `npm run typecheck && npm run lint && npm test` (today's green run validated the stale alphas).
2. iOS device smoke: release build boots and receives an APNs token (the static `@react-native-firebase/messaging` JS import with iOS pods excluded is the one unguarded surface); killed-app notification tap routes correctly **after** P0-1/P1-3 fixes.
3. Android device smoke: killed-app data-only (Notifee) tap routes after P1-4; release build fails without `google-services.json` after P2-14.
4. Offline smoke: add item offline → reconnect with list on screen (P0-2); create template offline → reconnect (P2-9); kill app mid-replay → relaunch (P1-7).
5. Theme-switch regression per P2-20.
6. Confirm server-side assumptions: quiet-hours send suppression; meal-deduction transition gating (P2-15); send gating on `pushEnabled` (P3).
7. Badge behavior: server-set badge survives app launch (P2-12); logout clears badge/inbox/token (P2-11).

---

## Code reuse & unification roadmap (fast-follow, ordered by leverage — none block the merge)

1. **`runLocalFirstMutation` runner** in `src/apollo/utils/`: the optimistic-write → mutate(localFirst) → classify → revert/alert/persist pipeline is hand-copied ~25+ times across 20 files in three flavors (settings-style boolean updates, online-only creates, ledger/idempotency mutations). ~350–450 LOC saved, and one authoritative encoding of the created/queued/rejected persistence semantics instead of ~25. Absorbs the `alertRejectedMutation` vs `alertIfRejected` split (69 lines of "which one, when" docs), the `getPayloadMessage` pattern (12 sites), and the duplicated `QUEUED_*` sentinels. Migrate flavor-by-flavor with existing tests as the harness. `useShoppingListBudget.ts`'s local `runUpdate` is this in miniature — promote it.
2. **`makeFragmentPatcher` factory** in `cacheUpdaters.ts`: five hooks define the identical ~15-line wrapper around `applyOptimisticFragmentPatch` (reminder/recurring/budget/complete/template hooks). ~55 LOC.
3. **Converge the four coexisting optimistic-write/revert mechanisms to two** (fragment-patch + field-update); migrate the 8 hand-rolled snapshot sites opportunistically, individually (each has small nuances). Document the two blessed forms in CLAUDE.md's mutation-patterns table.
4. **Test scaffolding**: add `src/services/__mocks__/alertService.ts` + `toastService.ts` auto-mocks (27 + 14 files repeat the inline factory); extend `renderHookWithApollo`/`recordMock` to capture operation `context` so the two hand-rolled Apollo scaffolds asserting `localFirst: true` can be deleted.
5. **Shared notification category→route map**: `pushNotificationRouting.ts:38-61` and `NotificationListScreen.tsx:105-114` both switch on category and have already drifted (push handles `Recipe`, in-app doesn't). Keep the differing per-site defaults — those are intentional.
6. **Decompose the three giants**: `ListSettings.tsx` (1,165 lines → section components per the PantryContent precedent), `useRecipePreload.ts` (786 → extract module-level cache writers like `recipeCacheWriters.ts`), `useRecipeScreen.tsx` (857 → pure search/dedupe/pagination helpers to a util). `useMealPlanItemActions.ts` drops ~190 lines once items 1 + the message helper land.
7. **Un-export test-only/internal symbols**: `getVersionConflictDetails`, `matchesFilter`. Pre-existing footnote: `queueDebug.ts` (216 lines) is dead on main too.

**Do NOT consolidate** (checked and intentionally distinct): iOS vs native push providers/messaging (different lifecycles; the `PushTokenProvider` seam already exists); `useMoveToPantry` vs `useBatchMoveToPantry`; per-schema input builders; `alertRejectedMutation`+`alertIfRejected` merged naively (double-alert/silent-failure risk — unify only inside the runner); forcing the asymmetric hooks (`useAddShoppingItem`, `useRemoveShoppingItem`, `useClearShoppingListItems`, `useCreatePantryItem`) into the runner; the many tiny colocated fragments (sanctioned convention); `useCrudOperations` migration (working code, don't touch — just don't use it in new code).

---

## What verified sound (coverage record)

- **Conventions:** zero hard violations across all 17 CLAUDE.md rules (memoization, InteractionManager, try/catch-in-hooks, Pressable sourcing, withUnistyles, bottom sheets, useUnistyles exceptions, casts, FlashList, masking, restricted fragments, scheduleOnRN, test mocking, render-time refs, inactiveBehavior, refetchQueries, feature boundaries).
- **GraphQL:** masking-identity rule holds on all new operations (test self-discovers `src/**/*.graphql`); zero schema drift / deprecated selections / lint suppressions; zero new `refetchQueries`; new hooks follow the sanctioned cache patterns; all renames applied consistently.
- **Offline core:** FIFO + dependency ordering, MMKV queue persistence with DocumentNode round-trip, the idempotency-key migration (persisted in variables — an improvement), optimistic write/revert pairs (no double-revert paths), replay outcome classification (`IDEMPOTENT_REPLAY` by code, never message), queueLink honesty split, `isApiUnavailable` gating, failure pipeline with entity evict + self-heal.
- **Notifications:** quietHours timezone/DST math, Notifee↔RNC delegate contention, warm-state tap routing, WS/FCM duplicate suppression, deferred opt-in flow (incl. Android 13 POST_NOTIFICATIONS), notificationSlice dedup/caps/counts, category-only tap-data trim (no consumer lost data).
- **Release wiring:** nav v8 static-API migration clean, explicit deep-link prefixes (neutralizes v8's `['*']` default), detail-screens-as-root-siblings preserved, `APS_ENVIRONMENT` per-config correct for TestFlight/App Store, version/build numbers consistent (4.1.1 / iOS 61 / Android 131), Firebase config hygiene (secrets not tracked, CI-injected), Podfile.lock in sync, zero lockfile peer-dep violations.
- **Dual-source recipe search:** cross-page dedupe, per-source exhaustion, offset math, stale load-more guard, empty-page freeze all correct (only the initial-search race in P3).
