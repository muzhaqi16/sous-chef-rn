# Proposal

## Why

A second xhigh review of PR 298 (`dev` → `main`), run after
`fix-pr-298-review-findings` was archived, reported 14 findings. Each was
checked against `dev` at c37387c53 and, where it rests on server or library
behaviour, against `sous-chef-api` (e6c679e13), Apollo Client 4.2.12 and
graphql-ws 6.2.1. Eleven hold, two hold in part, one was declined by the
product owner, and verification turned up three more. Several of them show the
wrong thing to a user who is allowed to act (a read-only budget, a report on
the wrong photo, prices compared across currencies), so they land before the
merge to `main`.

## What Changes

Confirmed, and fixed by this change (numbers are the review's):

1. **Budget & prices is read-only for everyone but the list's owner.** The API
   gates the budget, target store and price tracking on EDIT
   (`ShoppingListService.updateShoppingList`). A home MEMBER or an editing
   collaborator gets the controls, as List Settings already gives them.
3. **The navigation catch-up's early exit misses held `cache-only` queries.**
   `refetchQueries` skips them, so they are never recorded as answered, and
   while one is active every navigation drains the queue and walks every query
   to refetch nothing. Today only `useGenerateShoppingList`'s `GetPantry` is
   held; fix 15 adds three more. The check excludes what Apollo excludes.
4. **The foreground skip trusts the socket for too long.** The API reaps a
   socket that left a ping unanswered at its next 30 s tick, so subscriptions
   can be gone just over 30 s after the app leaves. The window is one ping
   interval, not two.
5. **"€0.50 below your usual $2.50."** The typed price is in the list's
   currency, the household's usual is in the caller's. A comparison is shown
   only when the two match.
6. **A recipe's open swaps sheet keeps the last home's swaps.** When the home
   goes away (or nothing is flagged any more) the query is skipped and its last
   answer stays. Swaps are read only while the query runs.
7. **A locale change reads amounts in metric for a moment.** Evicting
   `UserSettings.deviceUnitSystem` leaves every settings read incomplete until
   the refetch lands, so readers fall back to METRIC, even users who chose
   IMPERIAL. Forms seeded in that gap keep g/ml. The new value is written over
   the old one instead.
8. **"Report wrong photo" reports the lead photo, whatever page is shown.**
   It names the photo on screen.
9. **A settle event's refetch can join a poll already in flight** and get that
   poll's pre-settle answer, leaving the user up to 15 s on "parsing". Receipt
   parse and recipe capture both re-ask with a fresh request.
10. **The price sheet closes when the add-and-tick failed**, losing the typed
    price, sometimes with no message. It stays open, and every failure says so.
11. **The typical shelf price survives switching prices off** while a scan card
    is open. Store mode shows no money with prices off.
13. **`PurchaseAmountSheet` builds its own shell.** It becomes `Sheet` in
    `view` mode, which is what it hand-builds today.
14. **Three new doc comments run past six lines** (`useReportPhotoHeaderAction`,
    `forgetHome`, `appForeground`). Each is cut to what the code cannot say.

Found during verification, and fixed by this change:

15. **"Cache-only" reads that are not.** The client default
    `nextFetchPolicy: 'cache-first'` turns `fetchPolicy: 'cache-only'` into
    cache-first after the first read. Store mode's two cart reads say a second
    fetch "would reset" the lines store mode loaded, and `useCurrentHome` says
    `useDefaultHome` owns the fetch. They are held `cache-only`. The unread
    badge's resync re-read is kept (it is how a missed event's badge recovers),
    and its comment says so.
16. **Offline mode defeats the catch-up's early exit.** `offlineModeLink`
    answers every query before `languageLink` records it, and `canCatchUp`
    checks only the breaker. With offline mode on, every navigation drains the
    queue at once and refetches every query from the cache. A catch-up waits
    while the network is withheld, for either reason.
17. **The total-paid field is labelled "$" in every locale and currency.** The
    sheet takes the list's currency and shows its symbol.

Partly confirmed, and not changed:

- **12, the catch-up's fragment walker keys ignore variables.** True, but both
  sides of every pair it matches take the varying argument from the same
  source (`useSelectedHomeId()`), and a lookup waiting on new variables carries
  nothing, so no query is wrongly skipped today. `refetchOn: false` on the
  scan card's queries would stop "Last paid" refreshing on return, and is not
  possible for `StoreShelfPrices`, which also renders on two other screens.

Declined by the product owner:

- **2, catalog data notices on item screens.** `4e8fe02bf` moved them to Data
  Sources on purpose. This is a known departure from the API's documented
  contract ("a client shows them wherever it shows the item's facts"). The
  API's catalog doc leaves the licence question to the product owner.

Out of scope:

- **Half-open sockets in the foreground.** Detecting one needs a client pong
  timeout, which is a timer. Fix 4 narrows the window only.

## Capabilities

### New Capabilities

- `sync/navigation-catch-up`: when a navigation after a resync re-asks the
  server, and when it touches neither the queue nor the network.
- `sync/work-settled-refresh`: how a screen waiting on server work (a receipt
  parse, a recipe capture) shows the settled state once the work settles.
- `shopping/list-budget`: who may change a list's budget, store and price
  tracking.
- `shopping/purchase-price-entry`: what the purchase amount sheet asks for and
  labels when the user records what they paid.
- `barcode/scan-price-memory`: the price lines a store-mode scan shows from the
  household's history and the list's store, and when it shows none.
- `recipes/ingredient-substitutes`: which swaps a recipe's ingredient offers,
  and for which household.
- `profile/unit-system`: which unit system amounts read in while the device's
  locale or the user's setting changes.
- `catalog/photo-report`: which photo "Report wrong photo" names.

### Modified Capabilities

- `sync/foreground-resync`: the liveness window becomes one server ping
  interval (30 s), not two.
- `shopping/store-mode-cart`: adding with a price that fails keeps the sheet
  and the typed price, and the cart's reads never ask the network.

## Impact

- **Code:** `src/apollo/refetchEvents.ts`;
  `src/apollo/utils/unitSystemAnswers.ts`,
  `src/services/device/deviceRegistration.ts`,
  `src/graphql/operations/auth/device.graphql`;
  `src/features/shoppingList/screens/useListBudget.ts`,
  `src/features/shoppingList/hooks/useStoreModeCart.ts`,
  `src/features/shoppingList/ui/PurchaseAmountSheet.tsx` and its callers;
  `src/features/barcode/components/SearchResults.tsx`,
  `src/features/barcode/hooks/useStorePriceMemory.ts`;
  `src/features/recipes/hooks/{useRecipeSubstitutes,useRecipeCapturePoll}.ts`;
  `src/features/receipts/hooks/useServerReceiptParse.ts`;
  `src/features/catalog/ui/useReportPhotoHeaderAction.ts`;
  `src/features/pantry/hooks/useCurrentHome.ts`,
  `src/features/notifications/hooks/useUnreadNotificationCount.ts`;
  `src/domain/forgetHome.ts`. Each has a colocated test suite that gains a
  case for its finding.
- **Locales:** `purchaseAmountSheet.currencySymbol` goes from the four
  shopping-list locale files.
- **API:** none. The API repo stays read-only. Fix 1 relies on
  `checkAccess(EDIT)`; fix 4 on `WS_PING_INTERVAL_MS` and the reap loop in
  `packages/core/src/context/ws.ts`; fix 7 on `Device.user.settings` answering
  `deviceUnitSystem` for the requesting device.
- **Shared checkout:** a parallel session has uncommitted edits under
  `src/features/home/` and `src/components/atoms/SousChefLoader.tsx`. No task
  touches them.
