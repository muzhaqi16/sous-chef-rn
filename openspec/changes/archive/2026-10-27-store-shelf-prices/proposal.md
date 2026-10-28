# Proposal

## Why

The API now collects shelf prices from the stores households shop at (Kroger,
Giant Eagle, ALDI) and serves them per item as `Item.storePricesConnection`
(API 4.8.16, contract `sous-chef-api/docs/api/store-prices.md`). The client
pulled that schema in 46762b550 but reads none of it. So a shopper deciding
where to buy a list line, or standing at the shelf in store mode, cannot see
what it costs at each store now, whether it is on sale, or whether it is
cheaper elsewhere. Today they see only what their household paid and a pooled
"typical" figure.

## What Changes

- **A "Prices at stores" section on the shopping list's item detail.** One row
  per store that collected a price in the last 90 days, in the API's order
  (cheapest current price first). Each row shows the store and its price per
  the unit it is sold in. Where they apply, it also shows the price per kg, L
  or piece, the promotion against the regular price, the usual (typical)
  price, a 90-day low, and the aisle. A store whose price is older than 8
  days reads "Last seen <date>" and is never marked cheapest.
- **The same section on the barcode scan card in store mode only**, under the
  existing price lines. It rides the store-mode lookup query, so a scan sends
  no extra request. Outside store mode the card is unchanged.
- **The row for the list's own store is tagged**, so a shopper sees at once
  whether the store they are in, or the one the list is for, is the cheap one.
- **Hidden unless Settings → Budget & prices is on.** This follows the rule
  that prices off means no price is shown. With it off, the section is never
  requested.
- **A new build feature flag, `storeShelfPrices`** (default on). A fork or
  build whose API collects no prices switches the section off, and the screens
  then render exactly as they do today.
- **Per-kg/L/each price wording gets one shared home.** The barcode feature's
  `perKg`, `perL`, `each` and `perUnit` copy moves to `labels.pricePer.*`
  behind a shared formatter, and the scan card's existing price lines use it.
  The text the user sees does not change.

Out of scope: the pantry item detail, the scan card outside store mode, the
list-level store comparison (`ListBudget`), and any write. No API change is
needed.

## Capabilities

### New Capabilities

- `shopping/store-shelf-prices`: how an item's collected shelf price at each
  store is shown to a shopper. Covers the list item detail and the store-mode
  scan card, ordering and labelling, promotion, usual and low prices, staleness,
  the list's-store tag, currency, the Budget & prices gate and the build flag.

### Modified Capabilities

None. `openspec/specs/` holds no capability yet. The scan card's existing
behaviour is specified by the in-flight `fix-pr-298-review-findings` change
(`barcode/scan-result`); this change adds its store-mode behaviour under the
new capability instead of amending a spec that is not yet archived.

## Impact

- **New:** `src/features/catalog/hooks/useStoreShelfPrices` (data hook,
  fragments and fallback query) and `src/features/catalog/ui/StoreShelfPriceList`
  (rows), with tests; `src/features/barcode/components/StoreShelfPriceSection`
  (the scan card's section); the `storeShelfPrices` `FeatureFlag`; a shared
  price-per-basis formatter in `src/domain/money.ts`; `labels.pricePer.*` copy
  and the catalog locales' `storeShelfPrices.*` copy in en/es/it/sq.
- **Changed:** `src/features/shoppingList/screens/ItemDetail.tsx` (renders the
  section); `src/features/barcode/hooks/useSearchResults.graphql` (spreads the
  fragment under a new `$withShelfPrices`);
  `src/features/barcode/components/SearchResults.tsx` (renders the section in
  store mode); `src/features/barcode/hooks/useStorePriceMemory.ts` and
  `src/features/barcode/locales/*.json` (point at the shared wording).
- **Generated:** `persisted-query-manifest.json` gains the new operation and
  `ItemByLookup`'s new hash. The API's operation safelist is off, so nothing
  is registered server-side.
- **Sequencing:** the barcode files above are being edited by
  `fix-pr-298-review-findings` in this shared checkout. This change touches
  them only after that change's edits are committed.
