# Tasks

Each group is one commit on `dev` (Conventional Commits). Re-read every file
before editing it, since a parallel session shares this checkout. Run
`/simplify` before each code commit.

## 1. Foreground resync inside the liveness window (finding 1, D1)

- [x] 1.1 In `src/apollo/refetchEvents.ts`, replace `LONG_ABSENCE_MS` with `SERVER_LIVENESS_WINDOW_MS = 2 * 30_000`, citing `WS_PING_INTERVAL_MS` in `sous-chef-api` `packages/core/src/context/ws.ts`. Emit unless the channel reads open AND the absence is shorter than the window. Reword the `appForeground` doc comment. Verify `npx eslint src/apollo/refetchEvents.ts` is clean.
- [x] 1.2 In `src/apollo/__tests__/refetchEvents.test.ts`, replace the "15 minutes away" case with: open channel and 90 s away re-asks; open channel and 10 s away asks nothing; closed channel and 10 s away re-asks; a reconnect after a short return still resyncs. Verify `npx jest src/apollo/__tests__/refetchEvents.test.ts` passes and the 90 s case fails against `dev`'s code.
- [x] 1.3 Update `docs/apollo-client-patterns.md` (the `appForeground` table row and the "A return to the app over an open channel asks nothing" paragraph) and `docs/local-first-architecture.md` line 36 to describe the 60 s window. Verify `grep -n "15 min" docs/apollo-client-patterns.md docs/local-first-architecture.md` returns nothing about resync.

## 2. A create returns the row its line landed on (finding 2, D2)

- [x] 2.1 In `src/features/shoppingList/cache/createShoppingListRow.ts`, return as `id` the applied payload's `results[0].item.id` when present, else the minted id. Update the `ShoppingRowCreated.id` doc comment. Verify typecheck passes for the file.
- [x] 2.2 Add cases to `src/features/shoppingList/cache/__tests__/createShoppingListRow.test.ts`: a response naming an existing line returns that line's id, a queued create returns the minted id, and a refusal returns `outcome: 'reverted'`. Verify the merged case fails against `dev`'s code and passes after.
- [x] 2.3 Add a case to `src/features/barcode/hooks/__tests__/useAddScannedItem.shoppingList.test.ts` (real cache; `SearchResultsStoreMode.test.tsx` mocks both hooks, and its "adds an unlisted product as a line and ticks that line" case already pins the tick of the reported row): the add's response merges into line Y, so `rowId` is Y and only Y's row is cached. Verify it fails on `dev`'s code and passes after.
- [x] 2.4 In `docs/local-first-architecture.md` § the `createShoppingListRow` bullet, state that the returned `id` is the row the line landed on. Verify the text matches the code.

## 3. Store mode claims the purchase (finding 3, D3)

- [x] 3.1 Add `claimPurchased(lineId, bought)` to `src/features/shoppingList/hooks/mutations/useToggleShoppingItem.ts`. It writes `isPurchased: true`, moves the line to purchased only when the cache shows it open, and sends `purchaseTracking: { isPurchased: true, purchasedItem }`. Its revert and refetch on refusal match `toggleItem`'s. Verify the file lints clean.
- [x] 3.2 In `useStoreModeCart.ts`, make `tick` call `claimPurchased` when there is no price. Cover it in `useToggleShoppingItem.test.ts` and `useStoreModeCart.test.ts`: an already-purchased cached line stays purchased, and a repeated tick leaves it purchased. Verify `hookMembersAreConsumed.test.ts` still passes.
- [x] 3.3 Add `disabled?: boolean` to `ActionButtons.alternateAction` (`src/features/barcode/components/ActionButtons.tsx`), and pass `disabled: isLoading` from `SearchResults.tsx`. Add a `SearchResultsStoreMode.test.tsx` case: while "Add to cart" is in flight, "Add with price" is disabled (the shared stub passes a press through, as it does for the primary button; the real `Button` drops a disabled press). Verify it fails without `disabled: isLoading` and passes with it.

## 4. Brand-list matches follow the user's lists (finding 4, D4)

- [x] 4.1 Change `useProductBrandListings` to take `lists: readonly BrandListView[] | null` and keep a `listMatches` entry only while `lists` holds its list, switched on, with the match's entry id. Pass `brandLists.loaded ? brandLists.lists : null` from `SearchResults.tsx`. Verify typecheck passes.
- [x] 4.2 Add cases to `src/features/barcode/hooks/__tests__/useProductBrandListings.test.ts`: a deleted list drops out, a removed brand drops out, lists not loaded show the lookup's matches, and an add made on the device still shows. Verify the delete case fails against `dev`'s code and passes after.

## 5. A failed refresh is a stale check (finding 5, D5)

- [x] 5.1 In `src/domain/dietary.ts`, return `stale` from `householdCheckOf` when `answered && (offline || failed)`, and reword the `HouseholdCheck` doc comment. Add `src/domain/__tests__/dietary.test.ts` cases for answered and failed online (`stale`), answered and refreshed (`checked`), and failed with no answer (`failed`). Verify the tests pass.
- [x] 5.2 Add a `useRecipeDietaryAlerts` test with an answer carrying GraphQL errors beside its data, asserting `check === 'stale'` with the alerts shown. (A network error cannot reach the bug: Apollo 4.2.12 answers it `data: undefined`, `QueryManager` `catchError`.) Verify it fails on `dev`'s code and passes after.

## 6. Each skipped deduction claims one entry (finding 6, D6)

- [x] 6.1 In `src/features/recipes/hooks/useRecipeIngredientMatching.ts`, carry `stackUnitId` on each entry, and pair skips to distinct entries by stack name and units, falling back to the name alone, then to the skip itself. Count the distinct ingredients claimed plus the unclaimed skips. Verify the file lints clean, including the compiler-bailout rule (no value block inside a `try`).
- [x] 6.2 Add `useRecipeIngredientMatching.test.ts` cases: two same-named stacks both skipped (0 deducted, 2 failed), one of two skipped (1 and 1), an unmatched skip still counted, and a substitute's skipped part counting once. Verify the first case fails against `dev`'s code and all pass after.

## 7. Starting lines are guarded and withdrawn (finding 7, D7)

- [x] 7.1 In `src/features/shoppingList/hooks/useCreateShoppingList.ts`, wrap `lines?.write(id)` in a reporting `try`/`catch`. In `onFailed`, call `withdrawShoppingListItems(cache, id, items.map(line => line.id))` before `revertOptimisticShoppingList`. Verify the file lints clean (`sous-chef` rules, compiler bailouts).
- [x] 7.2 Add `useCreateShoppingList.test.ts` cases: a throwing `write` still sends the create and reports the error, and a refused create with 60 lines leaves none of the 60 `ShoppingListItem` entities in the cache (assert on `cache.extract()`). Verify both pass.

## 8. A refused recount undoes only its own write (finding 8, D8)

- [x] 8.1 In `src/features/pantry/hooks/mutations/useAdjustPantryItemQuantity.ts`, keep the snapshot only when the recount writes ahead (the snapshot's fragment covers every field `writeHeldStock` writes, so its undo is not needed). On refusal, restore only while the cached stack still reads the quantity, version and `updatedAt` it wrote. Verify the file lints clean.
- [x] 8.2 Add `useAdjustPantryItemQuantity.test.ts` cases: a cross-unit recount, refused after a newer write lands on the stack, leaves the newer quantity and version; a same-unit recount refused with nothing newer restores the snapshot. Verify the first fails against `dev`'s code and both pass after.

## 9. A refused sharing toggle re-reads the server (finding 9, D9)

- [x] 9.1 In `src/features/profile/hooks/useDietarySharing.ts`, replace `onFailed: () => writeShared(membershipId, !shared)` with a refetch of `DietarySharingHomes`. Update the hook's doc comment ("a refusal flips it back" becomes "a refusal shows the server's state"). Verify the file lints clean.
- [x] 9.2 Add `useDietarySharing.test.ts` cases: off, on, off, with the first refused last, ends showing the refetched `false`; a single refused toggle shows the refetched value; a queued toggle keeps the local value. Verify all pass.

## 10. A live held-stack hook (findings 11 and 14, D10)

- [x] 10.1 Add `src/features/pantry/hooks/useHeldStacks.graphql`, colocated with the new hook: a `useHeldStacks_pantry` fragment over the unfiltered `itemsConnection`, a `useHeldStacks_pantryItem` fragment carrying `createdAt` and the held amount, and a `HeldStacks($pantryId, $itemId, $stacksFirst)` query over `Pantry.itemsConnection(filters: { itemId })`. Run `npm run codegen`, then diff `src/graphql/generated/schema.graphql`; expect no change. Verify `npm run lint` passes for the `.graphql` files, including `find-stale-cache-fields`.
- [x] 10.2 Create `src/features/pantry/hooks/useHeldStacks.ts`: candidates from the client-mode connection through `useFragment`, else `HeldStacks` `cache-first`; stacks through `useFragmentList`; returns `seedUnit` and `joinedIn(unitId)` (the stack in that unit, else the oldest). Add `useHeldStacks.test.ts`: client mode updates live when a stack is written, server mode reads the query, an incomplete row is skipped by both choosers, `joinedIn` falls back to the oldest, and nothing is named with no pantry. Verify all pass.
- [x] 10.3 In `SearchResults.tsx`, replace both `useState(() => …Of(item.id))` reads with `useHeldStacks(pantryId, item.id)`. Feed `seedUnit` into `packageUnitOf`, `joinedIn` of the form's current unit (`useWatch` on `unitId`) into `joins`, and `seedUnit === null` into `createsStack` (unread stacks count as none, since the API ignores a consume unit on a join). Add a `SearchResults.test.tsx` case: the card opens before the pantry rows are cached, they load, the "creates a stack" copy goes away, and a typed amount is kept. Verify it passes.
- [x] 10.4 Remove `heldStackOf` from `usePantryIntake.ts`, `heldUnitOf`/`heldStackOf` from `useAddScannedItem.ts`'s return, and `readHeldStack` if nothing else reads it. Keep `heldUnitOf` and `readHeldStackUnit` for `useReceiptReview.addChosen`. Verify `npm run check:dead-modules` and `hookMembersAreConsumed.test.ts` pass.

## 11. Cache-first reads on the scan card (finding 12, D11)

- [x] 11.1 Give `useBrandLists` an optional `{ fetchPolicy }` argument and pass `cache-first` from `SearchResults.tsx`. Set `fetchPolicy: 'cache-first'` on the `StorePriceComparison` read in `useStorePriceMemory.ts`. Verify the profile brand-list screens' tests still pass unchanged.
- [x] 11.2 Add hook-level tests (the `SearchResults` suites mock both hooks): `useBrandLists({ fetchPolicy: 'cache-first' })` mounted twice over one cache sends one `BrandLists` request, and `useStorePriceMemory` for the same product mounted twice sends one `StorePriceComparison`. Verify both pass and fail against `dev`'s reads.

## 12. A `default` for enum values the build predates (finding 13, D12)

- [x] 12.1 Add `default: return price` to `perBasis` (`useStorePriceMemory.ts`), and `default: return null` to `sourceName` (`useProductOrigin.ts`; re-read it first, since a parallel session added the `ALDI`/`GIANT_EAGLE` cases). Add test cases that seed a basis and a source cast from an unknown wire string straight into the cache (the mock helper refuses values the schema cannot represent, which is the case under test), asserting the bare price and a null source. Verify `npx eslint` on both files is clean, and that the tests fail without the defaults and pass with them.

## 13. Cleanup (finding 15, D13)

- [x] 13.1 Delete the price-tracking comment from `src/features/shoppingList/hooks/useListSettings.ts`. Verify `grep -n "Price tracking toggles" src/features/shoppingList/hooks/useListSettings.ts` returns nothing.

## 14. Integration

- [x] 14.1 Run the full gate list: `npm run typecheck && npm run lint && npm test` (the full, unfiltered suite), then `npm run check:compiler-bailouts && npm run check:unistyles-variants && npm run check:dead-modules && npm run check:import-cycles`. Verify each exits 0, and record any known flake by name.
- [x] 14.2 On an emulator (`Pixel_7_API_36_MaryWalkerRt37354`, snapshot boot; `Pixel_9a`'s cold boot asks for an unknown PIN) with a rebuilt x86_64 `localRelease`, drive a store-mode scan result by deep link (`souschef://scan/result?barcode=…&source=storeMode&shoppingListId=…`) against the local API. Done 2026-10-27: with an open line put on the list through the API and never loaded on the device, "Add to cart" made the server fold the add into that line (quantity 2) and the line came out purchased, both online and through a queued replay after a transient API drop. Not observable on device: the disabled "Add with price" (prices are off for the test account, and the in-flight window is under a second online), and a deleted brand list on a mounted card (no navigation reaches the brand-list screens while a scan result with list matches is open). Unit tests cover both.

## Workflow follow-up

- Push the commits to `dev` so PR 298 picks them up, and re-request review.
- Archive the change with `/opsx:archive` once PR 298 merges.
