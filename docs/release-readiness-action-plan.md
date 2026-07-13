# Release Readiness — Remaining Actions (PR #166: dev → main)

_Updated 2026-07-13. All P0/P1/P2 **code** is landed and green (typecheck/lint/tests). The full six-dimension review and every resolved finding live in git history and the archived OpenSpec changes (`fix-p0-release-blockers`, `fix-p1-release-highs`, `fix-p2-release-mediums`, `validate-p0-p1-device-smokes`). This file now tracks **only what's left to merge + ship**._

## Verdict

**Not merge-ready.** Blocking: a regressed Android build, plus push/tap device smokes that need an FCM send path and a physical iOS device. Android offline + re-registration are device-validated; iOS is entirely unverified on hardware.

**Already validated on-device (Android, Galaxy S22 Ultra, 2026-07-13):** ✅ P0-2 offline-add survives reconnect · ✅ P1-5 restored-session re-registration · ✅ FCM init + real device token.

---

## 0. Blocker — restore the Android build (do first)

- [ ] **Fix `react-native-unistyles@3.3.0` on RN 0.83.9.** Its `cxx/converters/TransformOriginConverter.cpp` calls `facebook::react::parseUnprocessedTransformOriginString`, **removed in RN 0.83** (folded into `fromRawValue`); the `__has_include(<…/conversions.h>)` guard detects the header but not the missing function, so the CMake build fails (`no member named …`). CI Android has been **red since the 2026-07-11 unistyles bump** (`stg-v4.1.0`/`v4.1.1`; last green 2026-06-26). No fixed unistyles release exists (3.3.0 is latest).
  - **Fix:** patch the converter so `UNISTYLES_HAS_RN_TRANSFORM_ORIGIN_PARSER` stays undefined → its existing `std::nullopt` fallback (`Parser.cpp` then passes the raw `transformOrigin` string to RN; the only app use is `ProfileHeader.tsx`, behavior unchanged), made durable via `patch-package` + `postinstall`. Or bump unistyles when a compatible release ships.
  - [ ] **Verify:** clean `./gradlew assembleRelease` + `bundleRelease` green; a fresh `npm ci` re-applies the fix; CI Android green.

---

## 1. Android device smokes (device in hand)

- [ ] **P1-4 Notifee killed-app tap** routes to the target screen — **needs an FCM send path** (Firebase service-account JSON / legacy server key, or a manual send).
- [ ] **P2-9** offline meal-template create → reconnect (the `mergeConnectionByNodeId` pending-edge guard).
- [ ] **P2-11** logout clears badge/inbox/server token · **P2-12** server-set badge survives app launch.
- [ ] **P2-20** theme-switch regression (stacked detail screen + all tabs mounted, navigate back through each), Android.
- [ ] **P2-14** confirm a release build actually fails when `google-services.json` is absent.
- _Accept as unit-verified only:_ **P1-7** kill-mid-replay `PROCESSING`-strand recovery — durability confirmed on device (5/5 replayed, no loss), but the sub-second drain has no fault-injection surface to strand a mutation.

## 2. iOS device smokes (need a physical iOS device — none attached)

- [ ] **P0-1** killed-app `content-available` push completes within the failsafe window, **no watchdog termination** / double-completion.
- [ ] **P1-3** iOS cold-start notification tap routes to the target screen (and does not re-route on the next launch).
- [ ] Release build boots + **receives an APNs token** (static `@react-native-firebase/messaging` import is the unguarded surface).
- [ ] iOS legs of the offline smokes (P0-2 / P1-5).
- [ ] **P2-20** theme-switch regression, iOS.

## 3. Server-side / config confirmations

- [ ] **`pushEnabled` send gating (P3):** login registration calls `acquirePushToken()` without options — correctness depends on the server gating sends by preference. Confirm server-side.
- _Confirmed:_ quiet-hours suppression; meal-deduction transition gating ([api#178](https://github.com/muzhaqi16/sous-chef-api/issues/178)).

## 4. Full gate before submit

- [ ] With the build fix applied: `npm ci`, then `npm run typecheck && npm run lint && npm test` green on a fresh install.

## 5. P3 hygiene (cheap; optional this PR)

- [ ] Fix stale shared-fragment header `recipeFragments.graphql:57-58` (lists deleted `SuggestedRecipes` / renamed `FavoriteRecipe`; missing `ForkRecipe`).
- [ ] Delete orphaned `src/features/pantry/hooks/mutations/useOpenPantryItem.generated.ts`.
- [ ] Stale comments: `InvitationAcceptanceModal.test.tsx:138` (`refetchQueries` no longer used); `ShoppingListMainContent.tsx:65` (nonexistent `React.memo`).
- [ ] Initial recipe text-search stale-response guard (`useRecipeScreen.tsx:338-390`).
- [ ] Plan the RNFB `requestPermission`/`AuthorizationStatus` deprecation migration (the 3 lint warnings).
- [ ] Schedule the gesture-handler 3.x migration before nav v8 beta forces it.
- _(Full P3 list in git history.)_

## 6. Fast-follow (post-merge — none block)

- Code-reuse roadmap: `runLocalFirstMutation` runner (~350–450 LOC across 20 files), `makeFragmentPatcher` factory, `alertService`/`toastService` test auto-mocks, decompose the three giant files (`ListSettings.tsx`, `useRecipePreload.ts`, `useRecipeScreen.tsx`). _(Detail in git history.)_
