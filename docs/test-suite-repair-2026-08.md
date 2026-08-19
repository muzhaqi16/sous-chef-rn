# Test suite repair — August 2026

A record of tests that were **removed** or **rewritten** because they could not fail,
and of the `catch` blocks that were swallowing assertions.

The point of writing this down: a suite that shrinks looks like lost coverage. It was not.
Every entry below was demonstrated to pass while the thing it named was broken, so the
coverage was already zero — only the reporting was wrong. Each removal names its reason so
the decision is reviewable without re-deriving it.

Where a test named real behaviour and merely asserted too weakly, it was **strengthened**.
Removal was reserved for tests that asserted a mock, a type, a truthy React element, or a
testID the app does not render — those encode no intent worth preserving.

---

## 1. Unit tests

### `usePermission` — added AppState coverage

Deleting the hook's foreground re-check effect left all 7 existing tests green.
Four tests were added (foreground re-check, no re-check on background/inactive,
re-check targets the _current_ permission after a prop change, subscription teardown).

**Verified:** with the effect deleted, the original 7 still pass and all 4 new ones fail.

### `useBottomSheetBackdropClaim` — parameterised the reaction driver

The test driver only ever called the release reaction with `(closed: true, previous: false)`
— the single input where the `previous === false` race guard and its absence agree. Added
`driveReaction(closed, previous)` and cases for `previous === null` (first run),
`previous === true` (re-evaluation while closed), and `closed === false`, plus the
stale-release race: close → release → reopen onto a fresh slot → reaction re-fires.

**Verified:** removing the `&& previous === false` guard fails 3 of the new tests.

### `useShoppingListSelectorModal` — ten `expect(rendered).toBeTruthy()` replaced

A React element is always truthy, so all ten branch tests passed regardless of which branch
`renderCustomItem` took. Each now mounts the element and asserts the rendered output its
name claims (section-header icon, shared-by attribution and its fallbacks, item count
suppression at zero, checkmark presence).

**Verified:** four independent mutations (checkmark branch, header icon choice, displayName
fallback chain, zero-count suppression) each fail exactly the tests that name them.

### `authLink` — 16 tests removed, 24 added

Every test in the file asserted its own mocks. This is offline-auth logic whose failure
mode is wiping a session, so it was rewritten rather than deleted.

| Removed                                                  | Reason                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `isTokenExpiringSoon logic` (6)                          | Declared a **copy** of the helper inside the test file and tested the copy. The shipped function was never invoked. |
| `isRefreshTokenExpired logic` (4)                        | Same copy pattern, for a function `authLink.ts` no longer contains at all.                                          |
| `exports authLink`                                       | `toBeDefined()` on an import.                                                                                       |
| `provides API key and device ID for public operations`   | Asserted `expect(authLink).toBeTruthy()`. Never looked at a header.                                                 |
| `proactiveTokenRefresh is called when token is expiring` | Asserted `typeof mock === 'function'`.                                                                              |
| `tokenRefreshFailed is available in store state`         | Asserted its own mock object's shape.                                                                               |
| `defers (setNeedsTokenRefresh) when offline`             | **Called `setNeedsTokenRefresh(true)` itself**, then asserted it had been called.                                   |
| `attempts a server refresh when online`                  | Called `proactiveTokenRefresh()` itself, then asserted its own mock's return value.                                 |
| `throws when shouldSkipOperation returns true`           | Wrapped in `if (linkFn)` after probing for `contextSetter`/`setContext`; asserted nothing when the probe missed.    |

The replacement drives real operations through the link with `ApolloLink.execute` (the
`clientReleaseLink.test.ts` pattern) and asserts on the headers the downstream link
receives. Tokens are real JWTs so the shipped `jwt-decode` and expiry arithmetic run.

**Verified:** inverting the `isOnline` guard fails 5 tests; restoring `await` in front of
`proactiveTokenRefresh()` fails the non-blocking test in ~500ms.

### `HomeTabs` — two `toBeDefined()` tests replaced

Both had identical bodies (`expect(HomeTabs).toBeDefined()`), and `inactiveBehavior` — the
option the module exists to set — had zero test references anywhere in the repo. The
navigator factory is now mocked to capture its config, and four assertions replace them:
the four tabs are registered, `inactiveBehavior` is `'none'`, no individual tab overrides
it, and the lazy/animation options hold. Two matching tests were added in
`RootNavigator.test.tsx` for the root `Home` screen, which sets the same option, asserting
that `Home` is the _only_ root screen that opts out.

**Verified:** flipping `inactiveBehavior` to `'pause'` in either file fails.

---

## 2. E2E — dead page objects and specs

Measured first: of **243 literal testIDs referenced across `e2e/`, 135 do not appear
anywhere in `src/`.**

### Removed

| File                                                | Deadness               | Reason                                                                                                                                                                                                |
| --------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/screens/RecipeDetailScreen.ts`                 | 9/9 IDs absent         | Including its own `screenID` (`recipe-detail-screen`). Nothing it targets exists.                                                                                                                     |
| `e2e/screens/ProfileScreen.ts`                      | 12/23 absent           | Half its surface is unreachable.                                                                                                                                                                      |
| `e2e/screens/SettingsScreen.ts`                     | 23/26 absent           | Also had **zero consumers** — no spec imported it.                                                                                                                                                    |
| `e2e/tests/recipe/recipe-browse.e2e.ts`             | 12/12 `by.id()` absent | Every identifier it drives is absent.                                                                                                                                                                 |
| `e2e/tests/recipe/recipe-favorite.e2e.ts`           | 11/12 absent           | Same.                                                                                                                                                                                                 |
| `e2e/tests/profile/profile-account.e2e.ts`          | 11/13 absent           | Same.                                                                                                                                                                                                 |
| `e2e/tests/profile/profile-settings.e2e.ts`         | 9/9 absent             | Same.                                                                                                                                                                                                 |
| `Edit Item` block in `pantry-crud.e2e.ts` (2 tests) | 4/4 absent             | Drove `edit-item-button`, `edit-pantry-item-name-input`, `save-item-button`, `quantity-increment`. Both wrapped their entire flow, assertion included, in a try/catch that logged and navigated back. |

Repointing these means deciding what each surface _should_ assert. That is authoring new
coverage, not repairing existing coverage, so they were removed rather than guessed at.

### Kept

- `RecipesScreen.ts` trimmed to `screenID` + `navigateToTab` — the only two identifiers
  that exist. `core-flows.e2e.ts` uses exactly those.
- `app-settings-toggle.e2e.ts`, `notification-toggle.e2e.ts` — zero absent IDs.

### Helpers that silently no-op

`e2e/helpers/assertions.ts` had **zero importers**. Removed from it:

| Helper                                                                 | Reason                                                                                              |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `expectVisibleAndEnabled`                                              | Detox has no `toBeEnabled()`; only visibility was asserted.                                         |
| `expectVisibleButDisabled`                                             | Body **identical** to the above — passed on an enabled element, asserting the opposite of its name. |
| `expectElementContainsText`                                            | Ignored its `substring` argument entirely.                                                          |
| `expectListItemCount`                                                  | Probed a `<list>-item-<n>` pattern the app never renders, and never checked for extra items.        |
| `expectTabSelected`, `expectLoadingVisible`, `expectLoadingNotVisible` | Targeted `tab-<name>` / `loading-indicator`, absent from `src/`.                                    |

Added `expectDisappearsAfter(testID, action)`, which asserts the element is present
**before** the action. Detox satisfies `.not.toBeVisible()` for an element that does not
exist, so an unguarded disappearance check passes whether or not anything happened.

---

## 3. E2E — `catch` blocks that swallowed assertions

A `catch` in a spec is legitimate for genuinely optional UI (an overlay that may or may not
appear, a keyboard that may already be down, best-effort teardown). It is a defect when the
`try` contains the test's only assertion.

| Site                                                                                   | Was                                                                                                                                                                                                                     | Now                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helpers/auth.ts` — `loginWithCredentials`                                             | If neither `shopping-list-screen` nor `pantry-screen` appeared after login, it logged a warning and returned successfully. **Every spec built on this helper then asserted against whatever screen happened to be up.** | Throws.                                                                                                                                               |
| `login.e2e.ts` — `should login with valid credentials`                                 | The only assertion (`tab-bar` exists) was in a `try` whose `catch` took a screenshot. A login that never completed passed.                                                                                              | Screenshot retained, error rethrown.                                                                                                                  |
| `login.e2e.ts` — `should persist session across app restart`                           | Same shape. A dropped session passed.                                                                                                                                                                                   | Screenshot retained, error rethrown.                                                                                                                  |
| `login.e2e.ts` — `should handle special characters in password`                        | Accepted "still on login **OR** logged in". The password is not the test user's, so only one outcome is correct.                                                                                                        | Asserts it stays on login with an error.                                                                                                              |
| `login.e2e.ts` — `should handle rapid submit button taps`                              | Accepted "logged in **OR** still on login" — the exact failure the test is named for.                                                                                                                                   | Asserts the login completes.                                                                                                                          |
| `pantry-crud.e2e.ts` — `should delete item via swipe`                                  | Both the delete tap and the "item is gone" check were caught and logged.                                                                                                                                                | Both assert. Also repointed from the non-existent `swipe-action-delete` to `/^pantry-item-.+-delete$/`, the pattern `RightActions` actually composes. |
| `pantry-crud.e2e.ts` / `shopping-list-crud.e2e.ts` — `should validate empty item name` | The `catch` logged "validation handled", so a silent save passed.                                                                                                                                                       | Asserts the form is still open, i.e. nothing was created. Alert dismissal stays optional.                                                             |

Reviewed and left as-is (the `catch` guards genuinely optional UI or best-effort teardown,
and the assertion sits outside it): the keyboard-dismissal and autofill-dismissal blocks in
`login.e2e.ts` (now individually commented rather than bare `catch {}`), the `afterEach`
cleanup in `pantry-crud.e2e.ts`, the either/or navigation checks in `signup.e2e.ts` and
`password-reset.e2e.ts` (their final fallback is uncaught, so a total miss still throws),
and all of `ui-tour.e2e.ts`, which is a screenshot tool rather than a gate.

---

## 4. CI

`.github/workflows/e2e-nightly.yml` listed suites `shoppingList` (the directory is
`shopping-list`) and `onboarding` (no such directory). Both legs pointed at paths that do
not exist. Corrected to the directories that do.

---

## Standing gap

`e2e/` is excluded from `tsc` (see `tsconfig.json` `exclude`) **and** from ESLint (ignore
pattern), so it has no static checking of any kind. That is the soil the 135 dead
identifiers and ~15 unused imports grew in. Static checking would not have caught the dead
testIDs — they are strings — but it would have caught the rest, and it would give the
directory a floor.

---

## 5. `compilerSafeWrappers` removal — and the bug family it hid

The module existed to keep `try` out of hook bodies, on the premise that the React
Compiler bails out on `try/catch`. On the installed compiler (1.0.0) that premise is
false — see `scripts/probe-compiler-try-forms.mjs`. All 231 call sites were inlined:

| Wrapper                                                                           | Sites | Outcome                                                          |
| --------------------------------------------------------------------------------- | ----: | ---------------------------------------------------------------- |
| `executeQuery`                                                                    |    10 | removed                                                          |
| `executeRefetch`                                                                  |     2 | removed; `AbortError` check extracted to `utils/errors/abort.ts` |
| `executeSearchQuery`                                                              |     2 | removed                                                          |
| `executeCacheUpdate`                                                              |    87 | removed                                                          |
| `executeMutation`                                                                 |   144 | removed                                                          |
| `executeRefreshWithFinally`, `executeAsyncWithCleanup`, `executeWithLoadingState` |     — | **kept** — `finally` genuinely does bail out                     |

`compilerSafeWrappers.ts` → `finallyHelpers.ts` (the name now describes what it is).
`unwrapPayload` / `isSuccessPayload` moved to `utils/errors/mutationPayload.ts`; neither
contains a `try`.

**The real find.** Production sets `mutate: { errorPolicy: 'all' }`, so a failing
mutation **resolves** with `{ data: undefined, error }` rather than rejecting. Every
`catch` around a mutation was therefore near-dead, and the tests that stubbed
`executeMutation` to "simulate failure" were exercising a path the app barely takes.
Moving each handler to the resolved result surfaced five hooks that treated "the call
returned" as success:

| Hook                                               | Symptom                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `useImageUpload.updateItemImageUrl`                | Returned a `ForbiddenError` union member as if it were the updated item         |
| `updateProfileAvatarUrl` / `updateProfileCoverUrl` | Failed **silently** — the alert lived only on the unreachable throw path        |
| `useMoveToPantry.moveToPantry`                     | Returned `true` on failure and fired a success telemetry event                  |
| `usePantryItemActions.handleConfirmConsume`        | Closed the modal as if the usage had been recorded                              |
| `useShoppingListActions` quantity update           | Never reverted the optimistic quantity; no message, no version-conflict refresh |

Nine test suites were rewritten to drive the failure through `operationMocks` with an
`error` instead of stubbing a helper. The `CLAUDE.md` "Apollo test gotchas" entry that
documented the stub is replaced with this rule.

**Compiler constraint discovered while doing it.** A `try/catch` compiles, but only when
the TRY BODY contains no value block (`?.`, `??`, `&&`, `||`, ternary) — the catch body
is unrestricted. `check-compiler-bailouts.mjs` caught 13 violations introduced during the
refactor; each was fixed by hoisting the expression above the `try`.

---

## 6. `react-hooks/exhaustive-deps` re-enabled — triage list

The rule was `'off'`, citing React's compiler page as saying it "doesn't apply" under
`babel-plugin-react-compiler`. That page says no such thing, and the plugin ships the rule
**enabled** in the very preset it recommends for compiler users:

```
$ node -e "console.log(require('eslint-plugin-react-hooks').configs.recommended.rules['react-hooks/exhaustive-deps'])"
warn
```

Set to `'warn'` to match. It surfaces **8 warnings across 8 files** — small enough to
triage rather than suppress. First pass:

| Site                                                                 | Warning                                          | Assessment                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useBottomSheetBackdropClaim.ts:90`                                  | missing `releaseBackdrop` in the unmount cleanup | **Correct as written.** `releaseBackdrop` reads `claimIdRef.current` at unmount; adding it to a `[]` effect would re-register the cleanup every render. Wants a disable-with-reason. |
| `Toast.tsx:193`                                                      | missing `opacity`, `translateX`, `translateY`, … | **Likely correct.** Reanimated shared values are stable refs. Confirm, then disable-with-reason.                                                                                     |
| `PantrySettings.tsx:232`                                             | missing `t`                                      | **Correct as written.** `t` is only read to compose an alert at the moment of failure; adding it would re-fire the alert on a language change. Disable-with-reason.                  |
| `useDefaultHome.ts:372`                                              | missing `pantriesOf`                             | **Needs a look** — a genuinely omitted dependency would leave the effect reading a stale home.                                                                                       |
| `useNotificationSettings.ts:271`                                     | `updateNotificationSetting` changes every render | Compiler-stable in practice; verify against the bailout list before acting.                                                                                                          |
| `usePantryItemSuggestions.ts:79`, `useShoppingListSuggestions.ts:78` | `suggestions` array changes every render         | Same shape, same question.                                                                                                                                                           |
| `EmailVerificationDeepLinkScreen.tsx:207`                            | `handleVerified` changes every render            | Same.                                                                                                                                                                                |

None are fixed here — the rule arrives as a warning precisely so it does not land already
failing. The four "changes every render" hits are only real if the enclosing file is in
`scripts/check-compiler-bailouts.baseline.json`; for a compiled file the compiler does
stabilise them, which is the grain of truth the original (over-broad) justification had.

---

## 7. `useVariants` compiler bailouts — what was isolated, and what was not

All 63 bailing files share one cause: Unistyles' `styles.useVariants(...)` transform makes
the React Compiler bail out of the function containing the call
(`(BuildHIR::lowerAssignment) Could not find binding for declaration`). A bailout is
silent — the function simply stops being memoized.

**The check now names the bailing function.** `scripts/check-compiler-bailouts.mjs`
resolves each `CompileError`'s `fnLoc` to the enclosing declaration and prints it under
`--list`. Without that, a bailout in a one-line leaf extracted _on purpose_ to hold the
variant call was indistinguishable from the composite it was extracted to protect — which
made the baseline unactionable. With it:

- **24 files** were already in the intended shape: only a small leaf bails
  (`ExpirationText`, `StatusBadge`, `Dot`, `RadioMarker`, `OptionRow`, …).
- **The rest** bail in the file's own component.

### Isolated here (list rows and the composites behind them)

| File                                        | Extracted leaf                                              | Why it mattered                                |
| ------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| `molecules/ListItem.tsx`                    | `ListItemTitle`, `ListItemSubtitle`, `ListItemSubtitleSlot` | Renders every shopping-list row                |
| `molecules/BaseItemCard/BaseItemCard.tsx`   | `CardSurface`                                               | The row component behind every list in the app |
| `recipes/components/IngredientMatchRow.tsx` | `AvailabilityBadge`                                         | One row per recipe ingredient                  |
| `organisms/home/HomeInviteCard.tsx`         | `InviteSurface`, `InviteStatusBadge`                        | One card per pending invite                    |

Compiled function count went 811 → 815; the file count stays 63 because the extracted
leaves still bail, which is the point.

### Deliberately left

Trivial atoms — `Text`, `Button`, `Card`, `Badge`, `QuantityBadge`, `Loading`,
`SousChefLoader`, `SectionHeader`, `AddButton`, `NavigationButton`, and the form inputs.
A bailout in a leaf that renders one `<Text>` or one `<View>` costs almost nothing, and
churning the whole design system to chase the file count would trade real risk for a
number. `Text` is the headline case — 269 importers — but the bailout is in `Text`
itself, not its consumers, and `Text` is trivial.

Re-evaluate a file here only when a profile points at it, or when it grows derived state
or starts rendering a list.

## 8. Sign-out on a shared device — one path, and a sweep that notices

### The defect

Two sign-out paths existed and each cleared a different subset of state:

| | `resetStore('LOGOUT')` | `authService.logout()` |
|---|---|---|
| user + tokens | ✅ | ✅ |
| selected home/pantry/list/plan ids | ✅ | ❌ |
| Apollo in-memory + persisted cache | ✅ | ✅ |
| persisted queue / nav / persisted-queries keys | ❌ | ✅ |
| notification inbox | ❌ | ✅ |
| offline queue owner change | ❌ | ✅ |
| push deregistration | ❌ | ✅ |
| scanner's `recentlyScanned` | ❌ | ❌ |
| item autocomplete's `cachedItemSuggestions` | ❌ | ❌ |

The profile screen's sign-out button — the one people actually press — used the
left column. So the previous person's notification inbox, their queued offline
mutations, and their device's push registration all survived it; and neither
path ever cleared the barcode scanner's recent list or the seen-items LRU that
feeds item autocomplete. Both of those render directly to whoever opens the app
next.

A third path, `useStoreReset`, was dead in production (only its own test
referenced it) but exposed a fourth `logout()` for anyone to pick up.

### What changed

- `authService.logout()` is the only sign-out. The profile button calls it;
  `useStoreReset.ts` and its test are deleted.
- `authService.logout()` now delegates its store teardown to
  `resetStore({ auth: true, ui: true, clearApolloCache: false })` instead of the
  narrower `clearAuth()` — Apollo is already cleared by
  `performLogoutCleanup()` immediately above, so that pass is skipped.
- `SESSION_SCOPED_STATE` in `resetManager.ts` is the single list of what a
  session end removes. `resetStore` applies it in memory and
  `clearAuthFromStorage` deletes the same keys from the persisted blob, so the
  two cannot drift.
- The notification and scanner slices export their own `initial*State`, spread
  whole into that constant. A field added to either is cleared without anyone
  remembering to come back. `resetScanner` still keeps `recentlyScanned`
  deliberately (it survives closing the scanner); a session end does not.

### Removed as dead

- `emailNotifications` / `pushNotifications` and their two setters
  (`preferencesSlice`), plus their two `PERSISTED_KEYS` entries and two unit
  tests. No production reader or writer — the real toggles live in Apollo's
  `NotificationPreferences` via `useNotificationSettings`. They were persisted
  account state that nothing maintained.
- `pendingEmail` / `pendingPassword` entries in the auth reset. Not fields of
  `RootState`; the persist migration already sweeps non-allowlisted keys, so
  they could not be in a current blob. An untyped `Object.assign` had hidden
  that they did nothing — `satisfies Partial<RootState>` surfaced it.
- `src/hooks/useStoreReset.ts` + `src/hooks/__tests__/useStoreReset.test.ts`
  (7 tests). Dead in production, and a standing invitation to reintroduce the
  divergence above.

### The mechanism, not the fix

`src/store/__tests__/sessionEndLeavesNoData.test.ts` plants a marker in **every**
key of the real `PERSISTED_KEYS` allowlist, signs out, and requires each
survivor to be named in `KEPT_ON_PURPOSE` with a reason. Adding a persisted key
fails the test until someone classifies it.

That sweep is what found `emailNotifications` / `pushNotifications` — they were
not on anyone's list of suspects. Three fields were the visible defect; "no
mechanism to notice" was the actual one.

A fourth test asserts the exemption list cannot rot: every key in
`KEPT_ON_PURPOSE` must still be in `PERSISTED_KEYS`, so an exemption cannot
outlive its subject.

Falsified before landing: dropping `initialBarcodeScannerState` from the
constant turns the suite red on `recentlyScanned` and on the seeded
"Pregnancy test" scan; restoring it turns it green.

### Kept on purpose

Device-level appearance/accessibility/input choices, sort order, the per-user-id
`userPreferences` and `userNavigationStates` maps (per-account UI flags only,
unreachable without signing in as that account again, and what makes onboarding
and biometric-prompt state resume correctly), the shared catalog reference
caches and their freshness stamps, `navigationState` (set to `'auth'` by the
sign-out itself), and `userConsent`. Reasons are recorded per key in
`KEPT_ON_PURPOSE`.

## 9. Phase 6 — i18n, and the guards that replaced the sweeps

Each of these replaced a discipline nobody could sustain across four locale files
with something that fails a build. Every one was falsified before landing —
broken on purpose, confirmed red, restored.

| guard | catches | found on its first run |
| --- | --- | --- |
| `canonicalVocabulary.test.ts` | a feature redeclaring `errors.*` / `empty.*` / `labels.*` copy | — |
| `translationConsistency.test.ts` | two translations of one English string differing only by case or punctuation | — |
| `addresseeGender.test.ts` | copy inflected for the reader's gender | 6 Italian `accountEvents` strings |
| `pluralCategories.test.ts` | a locale missing a CLDR category, asked from `Intl.PluralRules` | — |
| `numberNounConcatenation.test.ts` | `${count} ${t('noun')}` and appending a literal `'s'` | — |
| `composedKeyNamespaces.test.ts` (extended) | a runtime-composed `${keyPrefix}.${suffix}` key with no resource | the 4 keys 6.3 wrongly merged |

### What the numbers were

- **33 → 6** duplicated error/empty-state strings; the 6 remaining are documented
  exemptions (server-code lookup table, the self-contained crash screen,
  runtime-composed prefixes, and two within-feature pairs kept distinct on
  purpose).
- **351 → 327** duplicated English strings overall; **166** of them had been
  translated inconsistently.
- **44 locale-groups** of typographic drift fixed (30 casing, 14 punctuation),
  113 values, by choosing between translations a human had already written.
- **230 left alone** and written to `docs/i18n-translator-review.md` — 22 are
  gender agreement and correct as-is; the rest are homonyms or synonym drift
  that need someone who reads the language.
- **78 strings de-gendered** across it/sq/es.
- **18 number-noun concatenations** converted to interpolating keys.

### Three things that went wrong while doing it

Worth recording, because each is a failure mode of this kind of work rather than
a one-off:

1. **A regex rewrite silently half-succeeded.** `\b` is ASCII-based, so the
   Albanian rewrites stopped matching after `të` and `t'i` — 5 strings were left
   gendered while the script reported success. The guard that caught it now
   asserts its own patterns still match the forms they were written for.
2. **A merge broke a runtime-composed key.** `alertMutationFailure` builds
   `${keyPrefix}.${suffix}`, which no static scan can see, so consolidating four
   of those keys onto a canonical one passed lint and typecheck and surfaced only
   as five failing hook tests. That was luck, not coverage;
   `composedKeyNamespaces.test.ts` now covers every prefix and checks the prefix
   list against the source.
3. **Two guards had false positives on their first run** — a loanword
   (`tagCount_one` is `"{{count}} Tag"` in Italian, identical to English and
   correct) and a separator (`${a ? ' · ' : ''}${t(...)}` is joining, not
   concatenating a number). Both were narrowed rather than exempted.

### The premise that did not survive

6.4 read as "make the duplicates consistent". Same English does not mean same
meaning: `Back` is `Atrás` for navigation and `Reverso` for the back of a
package; `Invite` is `Invito` the noun and `Invita` the button; `Default` is
`Predeterminado` or `Predeterminada` depending on the gender of the noun it
modifies. Unifying blindly would have replaced correct translations with wrong
ones, so only typographic drift was touched.

## 10. Phase 6.10 — the pantry sticky header

The task named one coupling; the installed `@shopify/flash-list@2.3.2` has two.
`ViewHolder`'s memo comparator (`src/recyclerview/ViewHolder.tsx`) reads

```ts
prevProps.extraData === nextProps.extraData &&
prevProps.renderItem === nextProps.renderItem &&
```

so an inline `renderItem` closing over filter state re-renders every mounted cell
even with `extraData` left alone, and vice versa. Fixing one would have looked
like a fix and changed nothing.

No item cell needs either value: the leaf renderer reads only `item`, and
`PantryItemCard` owns its own `useFragment` subscription. The tabs now read from
`PantryStickyTabsProvider`, which lets `renderPantryListItem` live at module
scope with a permanently stable identity and lets `locationFilter` leave
`extraData`.

`PantryStickyTabsDecoupling.test.tsx` asserts both prop identities directly,
because those two identities ARE the mechanism — FlashList's own comparator is
what is being satisfied. Verified by reintroducing the `extraData` coupling.

## 11. What the bailout baseline now protects

`scripts/check-compiler-bailouts.baseline.json` gained `isolatedLeaves`: the four
files where a `styles.useVariants(...)` call was deliberately extracted into a
leaf so the composite around it stays memoized.

The file count could not protect that. Moving the call back into the composite
leaves the count at 63 and the check green, silently undoing the extraction — so
the baseline records which function bails, not just that one does.

## 12. The e2e bootstrap reported everything as a `beforeAll` timeout

Every test in `pantry-crud` and `shopping-list-crud` failed as:

```
Exceeded timeout of 120000 ms for a hook.
```

That message names jest's timer and nothing else. Behind it were **two
independent defects**, and the first one masked the second.

### 12.1 An unbounded `system.element(...).tap()`

`dismissBiometricPromptIfPresent` taps iOS's "Save Password?" alert. It was
written as a retry loop:

```ts
for (let attempt = 0; attempt < 8; attempt++) {
  try { await system.element(by.system.label('Not Now')).tap(); break; }
  catch { await delay(500); }
}
```

The assumption is that the tap *throws* when the alert isn't there. It does
not — it **blocks**. On the overwhelmingly common path (no alert, because the
install isn't fresh) the first iteration never returns, and the hook runs out
its 120s.

This shape got there while fixing a typecheck error: Detox's `waitFor` is typed
for a `NativeElement`, and a system element is a separate type it rejects, so
the bounded wait was replaced with a bare tap. The type error was real; the
replacement dropped the bound. It is now raced against a timer, which is the
only bound available given the typing:

```ts
const dismissed = await Promise.race([
  system.element(by.system.label('Not Now')).tap().then(() => true).catch(() => false),
  delay(SYSTEM_ALERT_TIMEOUT_MS).then(() => false),
]);
```

**The tell that this was self-inflicted:** `pantry-crud` had passed 9/9 an hour
earlier with byte-identical spec code. When the spec didn't change and the
result did, the harness changed.

### 12.2 A fallback that could not rescue what it caught

With the hang bounded, the run failed in 52s with:

```
⚠️ Token injection failed: TypeError: fetch failed, falling back to UI login...
...
Test Failed: Timed out while waiting for expectation: TOBEVISIBLE WITH MATCHER(id == "login-screen") TIMEOUT(5s)
```

The reported failure is a missing login screen. The actual failure is that
**nothing was listening on `localhost:4000`**. `bootstrapAuthenticatedSession`
caught the token-fetch failure and fell back to UI login — but UI login posts to
that same endpoint, so the fallback could never work. It spent 50 seconds
converting an accurate error into an inaccurate one pointing at the app.

A connection-level failure is now its own error type, and is rethrown rather
than fallen back from:

```
ApiUnreachableError: The API at http://localhost:4000/graphql is not reachable (TypeError: fetch failed).
  Start it before running e2e, and re-check with:
    curl -sS -X POST http://localhost:4000/graphql -H 'content-type: application/json' -d '{"query":"{ __typename }"}'
  Not falling back to UI login — it posts to this same endpoint, so it would fail too,
  as a misleading "login-screen not visible" timeout.
```

Anything else still falls back — a changed mutation shape is exactly the case
the fallback exists for. **120s → 2s, and the message names the cause.**

### 12.3 Why the simulator screenshot looked healthy

Mid-diagnosis, a screenshot of the running app showed a fully populated pantry:
47 items, correct greeting, no error state. That is not evidence the API was up
— it is the persisted MMKV Apollo cache doing exactly what it is designed to do
(§ *Cache Persistence* in `CLAUDE.md`). **A healthy-looking screen is not a
reachable backend**, and on an offline-first app it cannot be used as one.
