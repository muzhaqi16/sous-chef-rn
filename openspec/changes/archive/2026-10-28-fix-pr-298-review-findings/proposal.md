# Proposal

## Why

The xhigh review of PR 298 (`dev` → `main`) reported 15 findings. Each was
checked against the code on `dev` (41dea7ee2) and, where it depends on server
behaviour, against `sous-chef-api` (62860084d): 14 hold and one does not. Four
of them lose or corrupt what the user sees in store mode or after the app
returns from the background, so they block the merge to `main`.

## What Changes

Confirmed, and fixed by this change:

1. **Foreground resync over a dead socket.** A return to the app skips the
   resync while `isLiveChannelOpen()` is true. That flag clears only on a
   graphql-ws `closed` event, and graphql-ws does nothing about a missing pong.
   The API ends a socket after two missed 30 s pings and drops its
   subscriptions. A return after that window resyncs whatever the flag says.
2. **A store-mode scan the server merges ticks nothing.** The API lands an
   add for an item the list already holds on that line, and the reconcile then
   removes the minted row. `createShoppingListRow` still returns the minted id,
   so the tick finds no row and fails silently. It returns the id of the row
   the line landed on.
3. **A store-mode tick flips instead of setting.** `toggleItem` writes
   `!isPurchased`, so a second add (the price button has no busy state) or a
   line already ticked elsewhere un-ticks it. A store-mode tick claims
   `isPurchased: true`. The API answers a claim of the state a line is already
   in without a write.
4. **The scan card's brand-list lines go stale.** Deleting a list or taking
   a brand off one never touches `Item.listMatches`. The card shows a match
   only while the user's lists still hold it.
5. **An answer that came with errors is shown as a clean dietary check.**
   `householdCheckOf` reports `checked` whenever data is present, even beside
   an error. A network failure cannot reach this: Apollo 4.2.12 answers it
   with `data: undefined`. An answer carrying GraphQL errors beside its data
   does reach it, since `errorPolicy: 'all'` keeps both. That case now reports
   `stale`, so the alerts still show, under the existing caption "Checked
   earlier; this may be out of date."
6. **The cook summary miscounts skips.** The API names a skipped ingredient
   only by its stack's `itemName` and units. Two entries drawn from same-named
   stacks collapse into one. Each skip claims one entry of its own.
7. **A list create's starting lines are written unguarded and left behind.**
   `lines.write` runs outside the `try` that guards the list write, and a
   refused create leaves its line rows in the cache. Both are fixed.
8. **A recount's revert overwrites newer data.** `revert()` writes the
   snapshot back even when nothing was written ahead (a recount stated in
   another unit). It reverts only what it wrote.
9. **A late refusal of a sharing toggle overrides a later choice.** After
   three quick toggles (off, on, off), a refusal of the first that arrives
   last turns the switch back on. A refusal re-reads the membership instead of
   guessing.
11. **The "joins your X" amount can come from a different stack than the
    unit.** `readHeldStack` and `readHeldStackUnit` choose from different sets
    of stacks. One chooser follows the API's rule: the stack in the add's unit,
    else the oldest.
12. **Every scan re-asks for the brand lists.** `useBrandLists` uses the
    default `cache-and-network` policy and mounts with each result. On the
    scan card it, and `StorePriceComparison`, read `cache-first`.
13. **A price basis or source newer than the build renders blank.**
    `perBasis` and `sourceName` have no `default` branch. `ExternalSource` has
    already gained `ALDI` and `GIANT_EAGLE`, so this has happened. Both switches
    get a `default`.
14. **The held stack is read from the cache during render.** The scan result
    reads it once in a `useState` initializer through `readFragment`, which
    CLAUDE.md rules out, and it never updates afterwards. It becomes a live
    `useFragment` read.
15. **Cleanup.** The comment left in `useListSettings.ts` about price tracking
    goes; the toggle now lives in `useListBudget`.

Refuted, and not changed:

- **10, a repeated country in a product's origin.** The API's `originOf`
  (`packages/core/src/services/catalog/productOrigin.ts`) runs each of
  `madeIn`, `ingredientsFrom` and `countryOfOrigin` through `byCountry`, so a
  country appears at most once per line.

## Capabilities

### New Capabilities

- `sync/foreground-resync`: when a return to the app re-asks the server for
  what it shows, and when the live channel lets it skip.
- `shopping/store-mode-cart`: how a scan in store mode finds, adds and ticks
  the line it fulfils.
- `shopping/list-creation`: what a list created with starting lines writes to
  the cache, and what a refused create takes back.
- `barcode/scan-result`: what the scan result card shows about the product: its
  brand-list matches, the stack an add joins, its origin and price lines, and
  how often it asks the server.
- `dietary/household-alert-check`: how the household dietary check reports
  whether its answer is current.
- `recipes/cook-deduction-report`: how the cook summary counts what was and
  was not deducted.
- `pantry/stock-recount`: what a refused recount puts back.
- `profile/dietary-sharing`: what the sharing switch shows after a refused
  toggle.

### Modified Capabilities

None. `openspec/specs/` holds no capabilities yet.

## Impact

- **Code:** `src/apollo/refetchEvents.ts`;
  `src/features/shoppingList/cache/createShoppingListRow.ts`,
  `src/features/shoppingList/hooks/useStoreModeCart.ts`,
  `src/features/shoppingList/hooks/mutations/useToggleShoppingItem.ts`,
  `src/features/shoppingList/hooks/useCreateShoppingList.ts`,
  `src/features/shoppingList/hooks/useListSettings.ts`;
  `src/features/barcode/components/SearchResults.tsx`,
  `src/features/barcode/hooks/{useAddScannedItem,useProductBrandListings,useStorePriceMemory,useProductOrigin}.ts`;
  `src/features/profile/hooks/{useBrandLists,useDietarySharing}.ts`;
  `src/domain/dietary.ts`;
  `src/features/recipes/hooks/useRecipeIngredientMatching.ts`;
  `src/features/pantry/hooks/mutations/useAdjustPantryItemQuantity.ts`,
  `src/features/pantry/utils/pantryCacheReaders.ts`,
  `src/features/pantry/hooks/usePantryIntake.ts`. Each has a colocated test
  suite that grows a case for its finding.
- **API:** none. The API repo stays read-only. Every fix relies only on a
  behaviour the API documents or implements today: the add-merge rule, the
  idempotent purchase claim, the forced-add join rule, the ping liveness
  window, `byCountry`, and the shape of `SkippedRecipeIngredient`.
- **Shared checkout:** `useProductOrigin.ts` was edited by a parallel session
  during verification (it added the `ALDI`/`GIANT_EAGLE` cases). Re-read it
  before touching it.
