# Design

## Context

See proposal.md for why; the requirements are in
`specs/shopping/store-shelf-prices/spec.md`. The contract is
`sous-chef-api/docs/api/store-prices.md`: `Item.storePricesConnection(first)`
is a ranked list that pages forward only. Its `ItemStorePrice` nodes have **no
id**, and each states its own `currency`.

What the code already does:

- **Store-mode scan.** The lookup is one query. `ItemByLookup`
  (`barcode/hooks/useSearchResults.graphql`) spreads each card hook's fragment.
  The household price memory rides it as `...useStorePriceMemory_item
  @include(if: $withPrices)`. `SearchResultsScreen` passes
  `source === 'storeMode' && showPrices` as `inStoreMode`, so `$withPrices` is
  already off with Budget & prices off.
- **By-id reads.** `Query.item` reads from `Item:<id>` (`readByIdFromCache`), so
  a by-id query for fields the lookup stored is answered from the cache.
- **Layers.** `ItemByLookup` is a **core** document, and a core document may
  spread only core fragments (`documentOwnership.test.ts`). So the new fragment
  lives in a feature's `hooks/`, not in `ui/` or `components/`.
- **The list's store.** `GetShoppingListDetails` selects
  `ShoppingList.targetStore { id name }`, and the list screen loads it before
  any line's detail opens. Store mode's `StorePriceComparison` caches it too.
- **Shared copy.** `canonicalVocabulary.test.ts` fails when two keys hold the
  same text in all four locales. The per-basis wording (`{{price}}/kg`, …)
  exists only in `barcode.price.*` today.
- **Parallel work.** `fix-pr-298-review-findings` is editing
  `useStorePriceMemory.ts` (a `default` arm in `perBasis`) and `SearchResults.tsx`
  in this shared checkout.

## Goals / Non-Goals

**Goals:**

- One data hook and one row component, used by both surfaces.
- A store-mode scan still asks once: shelf prices ride the lookup.
- With the flag or Budget & prices off: no request, no section, and the screens
  unchanged.

**Non-Goals:**

- Paging past ten stores. The API collects for a configured set of stores
  (`PRICE_COLLECTION_STORES`), so ten covers it.
- Converting `PER_KG`/`PER_L` to per-lb/per-fl-oz for imperial users. The scan
  card's existing lines show the server's basis too. Changing that is its own
  change.
- A loading skeleton or error state for the section. It is supplementary, so it
  appears when it has rows.

## Decisions

### 1. A core data hook in `catalog/hooks/`, a row component in `catalog/ui/`

`src/features/catalog/hooks/useStoreShelfPrices.{ts,graphql}` owns the
`useStoreShelfPrices_item` fragment and the fallback query. It returns
`{ rows: StoreShelfPriceRow[] }`: plain worded strings and flags, the same
style as `useStorePriceMemory`. `src/features/catalog/ui/StoreShelfPriceList.tsx`
renders the rows and the "Show N more" control. Each host wraps it in its own
container: a `DetailSection` on the item detail, a `Card` on the scan card.

The catalog owns the grocery `Item`. Its top-level `hooks/` and its `ui/` are
the feature's public surface, so both `shoppingList` and `barcode` may import
them.

*Rejected:*
- *A hook in `catalog/ui/` (colocated data hook).* `ItemByLookup` could not
  spread its fragment: that is the core-spreads-mobile violation.
- *A copy per feature.* That is two fragments for one field, and two places for
  the ranking rules.

### 2. The fragment is read with `useFragment`, and a query backs it only when missing

The fragment selects `storePricesConnection(first: 10)` with a literal `10`, so
the lookup and the fallback query share one cache key. The hook:

- runs `query StoreShelfPrices($itemId: ID!) { item(id: $itemId) { id
  ...useStoreShelfPrices_item } }` with `fetchPolicy: 'cache-first'`, or
  `skipToken` when disabled;
- reads the item with `useFragment(from: enabled ? Item ref : null)`;
- reads the list's store with a second fragment,
  `useStoreShelfPrices_list on ShoppingList { id targetStore { id } }`, through
  `useFragment` only, never through a query.

This copies `useStorePriceMemory`, the reference hook. On the scan card the
lookup has already stored the fragment, so the cache-first query is answered
from the cache and nothing is sent. On the item detail the query fetches once,
and resync (`RefetchEventManager`, `include: 'active'`) refreshes it on
foreground and reconnect.

The list's store is read from the cache, not queried. A query asking for
`shoppingList.targetStore` could miss the cache on the scan card before
`StorePriceComparison` answers, and that would send the request the spec
forbids. If the target store is not cached, the row simply has no tag.

*Rejected:* `cache-and-network` on the detail, which costs a request per open
for prices that change nightly.

### 3. The lookup carries the fragment under its own variable

`ItemByLookup` gains `$withShelfPrices: Boolean = false` and
`...useStoreShelfPrices_item @include(if: $withShelfPrices)`.
`useSearchResults` sets it to `inStoreMode && useFeatureFlag('storeShelfPrices')`.
`inStoreMode` already includes Budget & prices.

*Rejected:* reusing `$withPrices`. With the flag off the lookup would still ask
for shelf prices, which the spec forbids.

### 4. One switch inside the hook

`enabled = useFeatureFlag('storeShelfPrices') && useBudgetAndPricesEnabled() &&
!!itemId && !!listId`. The hook takes `listId: string | null | undefined`:

- the item detail passes its route's `listId`;
- the scan card passes `source === 'storeMode' ? shoppingListId : null`.

So "outside store mode" and "flag off" both mean no request and `rows: []`.

The hosts render the section on `rows.length > 0`, never on the flag. This is
the selector-hook seam `docs/architecture.md` describes: with the flag off,
each screen renders exactly what it renders today.

`storeShelfPrices` is a **build-owned** flag (default `true`), not in
`SERVER_FLAG`. The API has no `FeatureFlagName` for it, and a fork whose API
collects nothing turns it off.

### 5. How a row is worded

All money goes through `formatCurrency(amount, row.currency.code,
row.currency.decimalPlaces)`. Comparisons are made in minor units,
`Math.round(x * 10 ** decimalPlaces)`, as `compareToUsual` already does.

| Field | Rule |
| --- | --- |
| `price` | `normalizedBasis === EACH` and the normalized price equals the price in minor units: `labels.pricePer.each` ("$0.89 each"). Else `labels.pricePer.unit` with `unit.symbol` ("$1.29/lb"). |
| `perBasis` | `normalizedPrice` set and not the `each` case above: the shared per-basis formatter ("$2.84/kg"). A basis the build lacks returns `null`, so the line is left out. |
| `wasPrice` | `onPromotion`: "was $2.99" from `regularPrice`, plus a Sale badge. |
| `usual` | Price ≠ `typicalPrice` in minor units: "Usually $X". If `coveredDays < 30`: "Usually $X over N days" (plural). |
| `lowest` | `isCurrent` and price ≤ `lowestPrice` and price < `typicalPrice`: "Lowest in 90 days", or N days when `coveredDays < 30`. |
| `lastSeen` | `!isCurrent`: "Last seen Oct 16" via `formatMonthDay(new Date(confirmedAt))`. |
| `isCheapest` | Index 0, `isCurrent`, and at least 2 rows received. |
| `isListStore` | `store.id === list.targetStore?.id`. |
| `aisle` | Shown as the store states it. |

The rows keep the server's order and are never sorted again on the device.

### 6. The per-basis wording gets one home

`pricePerBasis(t, basis, price)` goes in `src/domain/money.ts`, the core module
for money that 2+ features share. It switches over `PriceBasis` with a
`default` arm returning `null`. The fix-pr-298 spec requires a value newer
than the build never to render a blank label, and `switch` + `default` is the
form `no-unnecessary-condition` accepts.

The copy moves to `labels.pricePer.{kg,l,each,unit}` in all four locales.
`barcode.price.{perKg,perL,each,perUnit}` is deleted, and `useStorePriceMemory`
calls the shared formatter. Its existing `default` (the bare price) stays at
its call site, as `?? price`. This must land in one commit: the moment both
keys exist, `canonicalVocabulary.test.ts` fails.

### 7. Cache policy for an id-less ranked list

`catalogTypePolicies.Item.fields.storePricesConnection` replaces the stored
value with each answer (`{ merge: false }`, which Apollo reads as "keep the
incoming value"). A ranked
list has no stable identity per row, and merging two answers would mix two
rankings. Stating the replacement also keeps Apollo from warning about lost
data when a refetch replaces the id-less object.

### 8. Row layout

A row follows the label/value layout `StorePriceSection`'s `PriceLine`
already uses inside a card. On the left: the store name, its aisle, and the
badges (Cheapest `success`, Sale `warning`, list's store `default`). On the
right: the price (`bodyStrong`) and caption lines (per-basis, was, usually,
lowest, last seen).

These are lines within one section, not a list of entities, so the
`RowCard`/`rowSurface` list-row pattern does not apply. Styles come from
`StyleSheet.create(theme => …)` with theme spacing. The expand state is a
`useState` in the component. testIDs go in `src/features/catalog/testIDs.ts`.

## Risks / Trade-offs

- **[`ItemByLookup` gets more expensive]** The API refuses an operation over
  its cost limit (3000 locally, 3500 in production). → Before shipping, send
  the store-mode lookup with `withShelfPrices: true` to the local API. A
  success there clears production too. If it is refused, lower `first` and
  amend the spec's ten-store cap.
- **[Overlap with fix-pr-298]** Concurrent edits to the barcode files. → The
  barcode tasks begin by checking that those files are clean and that change's
  edits are committed. If not, they stop and ask.
- **[Thin local data]** Only single-store, non-current Kroger rows exist
  locally, on 13 items (2 with barcodes). → The device checks use those, and
  every other state is pinned by Jest with SDL-completed mocks.
- **[Shared test account]** The emulator walk writes to real shared lists. →
  Add only the two lines the walk needs and remove exactly those. Flip Budget &
  prices back to its starting value. Probe the API with one cached login and no
  query loops: the account is rate-limited to 20 logins per 15 min and 100
  queries per minute.
- **[Stale nightly data]** A row can be up to a day old while it still reads
  as current. → That is the API's 8-day `isCurrent` rule, shown as stated.

## Migration Plan

Client-only and additive, with no stored-state migration: the persisted cache
gains a field. Rollback is reverting the commits, or turning the flag off with
`FEATURE_FLAGS=storeShelfPrices=off` for a build.
