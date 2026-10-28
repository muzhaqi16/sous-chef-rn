# Design

## Context

See proposal.md for the findings and the verification behind each. The fixes
are client-only and land on `dev` ahead of PR 298. Constraints that shape
them:

- The API repo is read-only. Each decision below names the API or library
  behaviour it stands on (Apollo Client 4.2.12, graphql-ws 6.2.1,
  `sous-chef-api` e6c679e13).
- No new refs and no timers in app code. State lives in `useState` or the
  store, and work runs from events.
- `skipToken` keeps serving the last run's data
  (`#apollo-skiptoken-keeps-serving-the-last-runs-data`), so a hook whose
  subject can change while skipped reads its data only while the query runs.
- The client default `nextFetchPolicy: 'cache-first'`
  (`src/apollo/defaultOptions.ts`) applies after a watcher's first read.
  `heldFetchPolicy` (`src/hooks/apollo/standDownOptions.ts`) is the one way to
  keep a policy for a query's life.
- A parallel session has uncommitted edits under `src/features/home/` and in
  `SousChefLoader.tsx`. Re-read every file before editing it.

## Goals / Non-Goals

**Goals:**

- Fix each finding where its cause lives: the hook that reads skipped data,
  the guard that checks the wrong flag, the eviction that empties a read.
  Never at one call site.
- Give each behaviour fix a test that fails on `dev` today.

**Non-Goals:**

- Finding 2 (data notices): declined by the product owner.
- Finding 12 (walker keys ignore variables): no wrong result today. Keyed
  values can be added if a pair ever takes its argument from two sources.
- A client pong timeout for half-open sockets. It is a timer.
- Moving the currency symbol to follow the locale's placement. The sheet's
  prefix stays a prefix (see Risks).

## Decisions

### D1 · Budget & prices uses List Settings' edit rule (finding 1)

`useListBudget` derives `canEdit` as `useListSettings` does:
`isOwner || permissions.canEditList`, with `permissions` from
`useShoppingListPermissions(list, user?.id)`. That hook encodes the API's EDIT
(owner, home MEMBER and above, collaborator with `canEdit`), and its
`resolved: false` keeps every control off until the answer is known. The
`useListBudget_list` fragment gains what the permissions hook reads (`homeId`,
the collaborator ids, the ownership ids, `home.myMembership`), with the same
fragment spreads the List Settings document uses.

- *Owner-only:* today's rule. Rejected, since the API accepts the write from
  every editor, and List Settings already offers the same people the same
  list's other settings.
- *A new shared `useCanEditList` hook:* would be the third rule in two places.
  Both hooks already call `useShoppingListPermissions`. Extract only if a
  third caller appears.

### D2 · The catch-up excludes what Apollo will not refetch (finding 3)

`reasks` (`src/apollo/refetchEvents.ts`) skips a query whose
`options.fetchPolicy` is `cache-only`, the same test Apollo's
`refetchQueries` applies (`QueryManager.js:799`). `getObservableQueries('active')`
already leaves out `standby`. A query held to the cache is never sent, so it
can never be recorded as answered, and counting it kept the early exit from
firing.

- *Record cache-only queries as answered at the resync:* rejected. It writes
  bookkeeping for a query no request touched.

### D3 · Hold the reads that say they are cache-only (finding 15)

`useStoreModeCart`'s two `GetShoppingListItemsFiltered` reads and
`useCurrentHome`'s `GetHomes` take `...heldFetchPolicy('cache-only')`. Their
comments state the intent: store mode loaded every line, and "a second
watcher's fetch would reset them"; `useDefaultHome` owns the homes fetch.
Today they become cache-first after the first read, so a resync or an
incomplete read sends them. `ObservableQuery.refetch` still forces
`network-only` on a cache-only query (`ObservableQuery.js:375-380`), so the
store-mode refusal path's `refetch()` keeps working.

`useUnreadNotificationCount` keeps its current options. Its resync re-read is
how the badge recovers from a server event missed while away, and no other
watcher on Today asks for it. Its comment changes to say it asks nothing on
mount and is re-read by a resync.

D2 lands with or before D3. Without it, the three newly held reads would make
every catch-up take the full path.

### D4 · A catch-up waits while the network is withheld (finding 16)

`canCatchUp` tests `!isNetworkWithheld(state)` (offline mode OR the breaker),
not `!isApiUnavailable(state)`. `offlineModeLink` answers every query before
`languageLink` records it, so in offline mode nothing is ever answered and
every navigation drained the queue (`whenIdle()` cancels the scheduled drain)
to refetch from the cache. The gate is read both when a navigation fires and
when the batch runs, as now. Queries left unanswered stay unanswered, so the
first navigation after offline mode turns off re-asks them.

### D5 · The liveness window is one ping interval (finding 4)

`SERVER_LIVENESS_WINDOW_MS = 30_000`. The API's single 30 s loop terminates a
socket already marked dead and otherwise marks it and pings
(`packages/core/src/context/ws.ts:386-408`). A socket that stops answering can
be reaped at the next tick, just over 30 s later. Its doc says "up to 2 ×
WS_PING_INTERVAL_MS", which is the maximum, not the minimum. The comment
states the earliest reap. The `foreground-resync` spec's window changes with
it, and `docs/apollo-client-patterns.md` and `docs/local-first-architecture.md`
drop "60 s".

### D6 · One currency for a typed price and what it is compared with (findings 5, 17)

A new hook `useListCurrency(listId)` in `src/features/shoppingList/hooks/`
returns the code a price on the list is recorded in: the list's `currency`,
else the preferred currency (`resolveCurrency`). This is the rule
`useStoreModeCart` inlines today as `recordsIn`, and that hook switches to the
new one. Its fragment `useListCurrency_list { id currency }` is spread by the
documents that already hold the list (store mode's cart fragment, the
shopping list screen's query).

- `useStorePriceMemory` takes that code. `compareToUsual` returns null when
  `summary.currency.code` differs. Asking `householdPriceSummary(currency:)`
  instead would change the field's arguments and lose the copy the scan
  lookup already stored.
- `PurchaseAmountSheet` takes a required `currency` prop and labels the field
  with `currencySymbol(code)`, a new formatter in
  `src/utils/formatters/number.ts`. It formats zero through the cached
  currency formatter and strips digits, separators and spaces, reading back
  from `format` as `getDeviceDecimalSeparator` does, since Hermes is most
  consistent there. If the formatter is missing it falls back to the code.
  The sheet's estimate hint uses the same code. `SearchResults` and
  `ShoppingListModalsContext` pass `useListCurrency(listId)`.
- `purchaseAmountSheet.currencySymbol` leaves all four locale files.

### D7 · Skipped queries serve nothing (findings 6, 11)

- `useRecipeSubstitutes` reads `recipeId && homeId && wanted ? data?.recipe
  : undefined`, as `useRecipeDietaryAlerts` does.
- `useStorePriceMemory` reads `comparison` and `store` from `here` only while
  `listId` is set.

A home switch does not need a variables check: the query runs for the new
home, so Apollo serves the new answer or none.

### D8 · A locale change refreshes the device's system in place (finding 7)

`dropDeviceUnitSystem` goes. After a registration that records a new locale,
`deviceRegistration` re-asks `GetUserSettings` with `fetchPolicy:
'network-only'` through the client. The answer overwrites
`UserSettings.deviceUnitSystem` in place. Every watcher keeps a complete read
until it lands, and a failure leaves the last known value, which is the
"last known system" the spec requires. `dropUnitSystemAnswers` stays: the
picker answers it evicts are root fields, re-asked on their next read, and no
settings reader depends on them.

- *Select `device { user { settings { id deviceUnitSystem } } }` on
  `registerDevice`:* one round trip, but it relies on the API's per-request
  `deviceLocales` loader not having been primed before the mutation wrote the
  new locale. Rejected for now. It is safe to adopt later.
- *Keep the eviction and set `returnPartialData`:* an architectural change
  (`defaultOptions.ts`). Rejected.

### D9 · The report names the photo on the page (finding 8)

`useReportPhotoHeaderAction` already resolves the photo on the current page
(`shown`). The report names `shown.id`. The entry's `catalogImageId` is used
only when the gallery has no photo pages, so the single hero is the entry's
image. A page with no catalog photo (the household's leading upload) offers
no report. `ItemPhoto.id` and `catalogImageId` share one id space
(`entryGallery` matches them).

### D10 · A settle event's refetch never joins an in-flight poll (finding 9)

Both polling queries (`useServerReceiptParse`, `useRecipeCapturePoll`) set
`context: { queryDeduplication: false }`. `refetch()` takes no context of its
own and reobserves with `this.options.context`, and `QueryManager` reads
`context.queryDeduplication` before sharing `inFlightLinkObservables`
(`QueryManager.js:510`). The cost is at most one extra request per settle.

- *Re-check after the joined answer if it still reads unsettled:* needs state
  about which answer came from which request. Rejected as more machinery for
  the same result.

### D11 · The price sheet closes only on a cart add (finding 10)

`addToCart` in `SearchResults` returns whether the product reached the cart,
and `handlePrice` closes the sheet only on `true`. Today `useToggleShoppingItem`'s
`setPurchased` returns `false` silently in three places (no list, no cache id,
no complete snapshot). Each now reports `errors.updateItemFailed`, the message
its refusal path already shows through `settleMutation`. That makes "a false
tick has told the user" hold for every caller, the shopping list screen's
included. The implementer also checks whether the add's answer writes every
field `useToggleShoppingItem_item` reads on a merged line the device had not
loaded, and spreads the fragment on the create's result if not.

### D12 · `PurchaseAmountSheet` on `Sheet` (finding 13)

The sheet becomes `<Sheet mode="view" snapPoints={[]} enableDynamicSizing>`
with its `SheetHeader` as the first child and no `title`. `view` is the
`BottomSheetView` it builds by hand today, and it keeps the content-sized,
non-keyboard-aware layout its comment requires. The inputs stay
`ThemedBottomSheetTextInput`.

### D13 · Comments (finding 14)

Each named comment is cut to what the code cannot say, at most six lines.
`appForeground` is re-cut after D5 changes it.

## Risks / Trade-offs

- [D3 stops a resync refreshing store mode's cart lookup and the current home
  through these watchers] → Their owning queries (store mode's paginated
  reads, `useDefaultHome`) are refetched by the same resync. Verify on device
  that a line ticked by another member still shows in the cart after a return.
- [D5 resyncs on returns between 30 and 60 s that rarely needed it] → One
  resync per such return, the cost the PR already accepts past the window.
- [D6's prefix sits before the amount even where the locale puts the symbol
  after] → The field reads "€ 2,00" in Italian rather than "2,00 €". That is
  still the right currency, and the placement can follow the locale later
  without changing the spec.
- [D11's new message on a silent `false` could show on the list screen for a
  row with an incomplete snapshot] → That tap does nothing today with no
  explanation. A message is better, and the snapshot check in D11 should make
  it rare.
- [D8 leaves pickers asked once in the old system if they are read before the
  re-read lands] → They are evicted and re-asked on next read, as today. Only
  the settings read changes.

## Migration Plan

Client-only, no data migration. Each task group is one commit on `dev`. A
revert of any one group restores its finding and nothing else, except D2 and
D3: D3 reverts with D2 or alone, never D2 alone.
