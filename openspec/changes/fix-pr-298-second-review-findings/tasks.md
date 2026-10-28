# Tasks

Each group is one commit on `dev` (Conventional Commits). Re-read every file
before editing it, since a parallel session shares this checkout (it has
uncommitted edits under `src/features/home/` and in `SousChefLoader.tsx`;
touch neither). Run `/simplify` before each code commit. A test that "fails on
`dev`" is checked by running it before the fix.

## 1. The catch-up skips what Apollo never sends (findings 3, 15, 16; D2, D3, D4)

- [x] 1.1 In `src/apollo/refetchEvents.ts`, make `reasks` skip a query whose `options.fetchPolicy` is `cache-only`. Add a `refetchEvents.test.ts` case: after a resync, a navigation with only a held `cache-only` watcher and answered network queries on screen calls neither `queueManager.whenIdle` nor `refetchQueries`. Verify it fails on `dev` and passes after.
- [x] 1.2 In the same file, gate `canCatchUp` on `!isNetworkWithheld(state)`. Add cases: with `offlineModeEnabled` a navigation after a resync drains nothing and refetches nothing, and once offline mode is off, the next navigation re-asks the unanswered queries. Verify both pass, and that the first fails on `dev`.
- [x] 1.3 Give `useStoreModeCart`'s two `GetShoppingListItemsFiltered` reads and `useCurrentHome`'s `GetHomes` read `...heldFetchPolicy('cache-only')`. In `useStoreModeCart.test.ts`, assert that a `client.refetchQueries({ include: 'active' })` sends no request for the cart's two reads, and that a refused tick's `refetch()` still asks the server. Add `src/features/pantry/hooks/__tests__/useCurrentHome.test.ts`, asserting that the read sends nothing when the homes list is evicted. Verify all pass, and that the first fails on `dev`.
- [x] 1.4 Rewrite `useUnreadNotificationCount`'s comment: it asks nothing on mount, and a resync re-reads it because the default `nextFetchPolicy` makes it cache-first after its first read. Verify `npx eslint` is clean on the four files touched in this group.

## 2. One ping interval of trust (finding 4, D5)

- [x] 2.1 Set `SERVER_LIVENESS_WINDOW_MS = 30_000` in `src/apollo/refetchEvents.ts`. Its comment states that the API reaps a socket at the tick after its first missed ping (`sous-chef-api` `packages/core/src/context/ws.ts`). Cut the `appForeground` docblock to six lines or fewer (finding 14). Add a `refetchEvents.test.ts` case: channel reads open and 40 s away re-asks. Update the "90 s" and "10 s" cases only if their numbers no longer straddle the window. Verify the 40 s case fails on `dev` and passes after.
- [x] 2.2 Replace "60 s" with "30 s" (one ping interval) in `docs/apollo-client-patterns.md` (the `appForeground` table row and the "A return within 60 s" paragraph) and `docs/local-first-architecture.md` line 36. Verify `grep -n "60 s" docs/apollo-client-patterns.md docs/local-first-architecture.md` finds nothing about resync.

## 3. Budget & prices for every editor (finding 1, D1)

- [x] 3.1 Add to `useListBudget_list` (`src/features/shoppingList/screens/useListBudget.graphql`) what `useShoppingListPermissions` reads: `homeId`, the collaborator ids with their fragment, the ownership ids with their fragment, and `home { id myMembership }`, using the same spreads as the List Settings document. Run `npm run codegen` and diff `src/graphql/generated/schema.graphql` (expect no change). Verify `npm run lint` passes for the `.graphql` files.
- [x] 3.2 In `useListBudget.ts`, set `canEdit` to `isOwner || permissions.canEditList`, as `useListSettings` does, and reword its doc line. Add `useListBudget.test.ts` cases: a home MEMBER on another member's list can edit; a collaborator with `canEdit` can edit; a view-only collaborator cannot; nothing is editable before the list loads. Verify the MEMBER case fails on `dev` and all pass after.

## 4. One currency per price (findings 5, 17; D6)

- [x] 4.1 Add `currencySymbol(code)` to `src/utils/formatters/number.ts`: format zero through the cached currency formatter, strip digits, separators and spaces, and fall back to the code. Add `number.test.ts` cases for USD → "$", EUR → "€", JPY → "¥", and an unknown code → the code. Verify they pass.
- [x] 4.2 Add `src/features/shoppingList/hooks/useListCurrency.ts` and `useListCurrency.graphql` (`useListCurrency_list { id currency }`): the list's currency, else `resolveCurrency` over the preferred one. Spread the fragment where the list is already read (`useStoreModeCart_list`, the shopping list screen's query). Switch `useStoreModeCart`'s `recordsIn` to it. Run `npm run codegen`. Add `useListCurrency.test.ts`: the list's code wins; no list currency falls back to the preferred one. Verify `useStoreModeCart.test.ts` still passes.
- [x] 4.3 Give `PurchaseAmountSheet` a required `currency` prop. Label the total-paid field with `currencySymbol(currency)`, and format its estimate hint in that currency. Pass `useListCurrency(listId)` from `SearchResults.tsx` and `ShoppingListModalsContext.tsx`. Remove `purchaseAmountSheet.currencySymbol` from the four `src/features/shoppingList/locales/*.json`. Add a `PurchaseAmountSheet.test.tsx` case: a EUR list's field is labelled "€". Verify `npm run typecheck` passes and no locale test fails.
- [x] 4.4 Make `useStorePriceMemory` take the price's currency (from `useListCurrency` in `SearchResults`), and have `compareToUsual` return null when `summary.currency.code` differs. Add `useStorePriceMemory.test.ts` cases: EUR typed against a USD usual shows no comparison; EUR against a EUR usual reads "€0.50 below". Verify the first fails on `dev` and both pass after.

## 5. Skipped queries serve nothing (findings 6, 11; D7)

- [x] 5.1 In `src/features/recipes/hooks/useRecipeSubstitutes.ts`, read `recipeId && homeId && wanted ? data?.recipe : undefined`. Add `useRecipeSubstitutes.test.ts` cases: after an answer, `homeId` going null and `wanted` going false each leave `substitutesFor` empty. Verify both fail on `dev` and pass after.
- [x] 5.2 In `src/features/barcode/hooks/useStorePriceMemory.ts`, read `comparison` and `store` from `here` only while `listId` is set. Add a `useStorePriceMemory.test.ts` case: answered for a list, then rerendered with `listId` undefined, `typical` is null. Verify it fails on `dev` and passes after.

## 6. A locale change refreshes in place (finding 7, D8)

- [x] 6.1 Remove `dropDeviceUnitSystem` from `src/apollo/utils/unitSystemAnswers.ts` and its test. In `src/services/device/deviceRegistration.ts`, after `recordRegisteredLocale` is true, keep `dropUnitSystemAnswers(cache)` and re-ask `GetUserSettingsDocument` with `fetchPolicy: 'network-only'` through the client, reporting a failure through the logger only. Verify `npm run check:dead-modules` passes.
- [x] 6.2 In `deviceRegistration.test.ts`, replace the eviction case with: a recorded locale change re-asks settings over the network, and the cached settings stay complete (a `cache.readQuery` of `GetUserSettings` returns data) until the answer lands, then carry its `deviceUnitSystem`. Add a case where the re-ask fails, so the cache keeps the old value. Verify both pass, and that the "stays complete" assertion fails on `dev`.

## 7. The report names the page's photo (finding 8, D9)

- [ ] 7.1 In `src/features/catalog/ui/useReportPhotoHeaderAction.ts`, report `shown.id` when the page shows a catalog photo. Fall back to `image?.catalogImageId` only when the gallery has no photo pages, and offer no report on a page with no catalog photo. Cut the docblock to six lines or fewer (finding 14). Add `useReportPhotoHeaderAction.test.ts` cases: page 2 of three reports the third photo's id; the household's leading upload offers no report while the next page does; a single-image hero reports the entry's `catalogImageId`. Verify the page case fails on `dev` and all pass after.

## 8. A settle event's refetch sends its own request (finding 9, D10)

- [ ] 8.1 Add `context: { queryDeduplication: false }` to the polling `useQuery` options in `src/features/receipts/hooks/useServerReceiptParse.ts` and `src/features/recipes/hooks/useRecipeCapturePoll.ts`. In each test suite, add a case: a settle event that arrives while a poll is in flight sends a second request, and the hook shows the settled answer. Use a link that holds the first response. Verify each fails on `dev` and passes after.

## 9. The price sheet stays open on a failed add (finding 10, D11)

- [ ] 9.1 In `src/features/shoppingList/hooks/mutations/useToggleShoppingItem.ts`, make the three silent `return false` paths in each setter (no list, no cache id, no complete snapshot) report `errors.updateItemFailed` as the refusal path does. Add `useToggleShoppingItem.test.ts` cases: a tick on a line with no cached snapshot returns false and shows the error. Verify it fails on `dev` and passes after.
- [ ] 9.2 In `src/features/barcode/components/SearchResults.tsx`, make `addToCart` return whether the product reached the cart, and have `handlePrice` close the sheet only on `true`. Add `SearchResultsStoreMode.test.tsx` cases: a refused tick keeps the sheet open with the typed price; a failed add keeps it open; success closes it. Verify the refused case fails on `dev` and all pass after.
- [ ] 9.3 Check whether the store-mode add's answer writes every field `useToggleShoppingItem_item` reads when the server merges into a line the device had not loaded. Use a real-cache case in `src/features/barcode/hooks/__tests__/useAddScannedItem.shoppingList.test.ts`: tick the merged row right after the add. If the snapshot is incomplete, spread `useToggleShoppingItem_item` on the create's result row, run `npm run codegen`, and verify the case passes.

## 10. `PurchaseAmountSheet` on `Sheet`, and the last comment (findings 13, 14; D12, D13)

- [ ] 10.1 Rebuild `src/features/shoppingList/ui/PurchaseAmountSheet.tsx` on `<Sheet mode="view" snapPoints={[]} enableDynamicSizing>`, with `SheetHeader` as its first child, keeping `ThemedBottomSheetTextInput`. Drop the direct `useStandardBottomSheet` and `BottomSheetView` imports. Verify `PurchaseAmountSheet.test.tsx` passes, and on an Android emulator that focusing the price field seats the sheet on the keyboard with its header visible (screenshot before and after).
- [ ] 10.2 Cut the `forgetHome` docblock (`src/domain/forgetHome.ts`) to six lines or fewer, keeping what the code cannot say. Verify `npx eslint src/domain/forgetHome.ts` is clean.

## 11. Integration

- [ ] 11.1 Run `npm run typecheck && npm run lint && npm test` (the full suite, unfiltered), then `npm run check:compiler-bailouts && npm run check:unistyles-variants && npm run check:dead-modules && npm run check:import-cycles`. Verify all pass, or that each failure is a known flake confirmed by a rerun.
- [ ] 11.2 On a dev build on an emulator: open Budget & prices as a home MEMBER on another member's list and change the budget; scan in store mode on a EUR list and add with a price ("€" label, no USD comparison); swipe an item's hero to its second photo and confirm the report dialog. Verify each by screenshot.

## Workflow follow-up

- Archive the change after PR 298's review requirements are satisfied, then sync its deltas into `openspec/specs/`.
