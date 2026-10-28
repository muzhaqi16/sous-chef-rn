# Spec Delta

## Purpose

Shows a shopper what an item costs on the shelf at each store that collected a
price for it, so they can choose where to buy a list line and see at the shelf
whether the store they are in is the cheap one.

## ADDED Requirements

### Requirement: The list item detail shows prices at stores

The shopping list's item detail SHALL show a "Prices at stores" section when
the line's item has at least one collected store price. It lists one row per
store in the order the server ranks them: current prices cheapest first, then
the stores whose price is not current. With no collected price, the section
SHALL be absent.

#### Scenario: Three stores priced

- **WHEN** a line's item is priced at Giant Eagle $2.49, Kroger $2.79 and ALDI $1.99, and the server ranks them ALDI, Giant Eagle, Kroger
- **THEN** the item detail shows a "Prices at stores" section with rows ALDI, Giant Eagle, Kroger in that order

#### Scenario: No collected price

- **WHEN** a line's item has no store price
- **THEN** the item detail shows no "Prices at stores" section and no empty placeholder

### Requirement: Long store lists start collapsed

The section SHALL show at most three stores at first. When more stores are
priced, a control SHALL name how many more there are and reveal them in place.
The section SHALL show at most ten stores.

#### Scenario: Five stores priced

- **WHEN** an item is priced at five stores
- **THEN** the section shows the first three and a "Show 2 more" control, and pressing it shows all five

#### Scenario: Three stores priced

- **WHEN** an item is priced at three stores
- **THEN** the section shows all three and no "Show more" control

### Requirement: The store-mode scan card shows prices at stores

A barcode scan opened from store mode SHALL show the same section on its
result card, below the household's price lines. A scan outside store mode
SHALL NOT show it.

#### Scenario: Scan in store mode

- **WHEN** the user scans a product priced at two stores while in store mode
- **THEN** the result card shows the "Prices at stores" section with both stores

#### Scenario: Scan from the pantry

- **WHEN** the user scans the same product from the pantry's scanner
- **THEN** the result card shows no "Prices at stores" section

### Requirement: A store-mode scan asks for prices with the product

The store prices on the store-mode scan card SHALL arrive with the scan's
product lookup. Showing them SHALL NOT send a request of its own.

#### Scenario: One request per scan

- **WHEN** the user scans a product in store mode
- **THEN** no `StoreShelfPrices` request is sent, and the card's store prices arrive with the product lookup

### Requirement: A row states the price per the unit it is sold in

Each row SHALL show the store's name and what a shopper pays now, per the unit
it is sold in ("$1.29/lb"). A price per piece SHALL read "$0.89 each".

#### Scenario: Sold by the pound

- **WHEN** Kroger sells Roma tomatoes at $1.29 per lb
- **THEN** the Kroger row reads "$1.29/lb"

#### Scenario: Sold by the piece

- **WHEN** Kroger sells garlic at $0.89 per piece
- **THEN** the Kroger row reads "$0.89 each"

### Requirement: A row states its price per kilogram, litre or piece

When the server states a price per kilogram, litre or piece that differs from
the price as sold, the row SHALL also show it ("$2.84/kg"). A basis this build
does not know SHALL leave this line out, never show an empty label.

#### Scenario: Weighed produce

- **WHEN** Roma tomatoes cost $1.29/lb and the server states $2.84 per kg
- **THEN** the row shows "$1.29/lb" and "$2.84/kg"

#### Scenario: Price per piece equals the price

- **WHEN** garlic costs $0.89 each and its price per piece is $0.89
- **THEN** the row shows "$0.89 each" once and no second per-piece line

#### Scenario: Unknown basis

- **WHEN** a row arrives with a per-unit basis this build does not know
- **THEN** the row shows its price and no per-unit line

### Requirement: A promotion shows the regular price

When a store's price is a promotion, the row SHALL mark it as a sale and show
the regular shelf price it replaces.

#### Scenario: On promotion

- **WHEN** Giant Eagle sells an item at $2.49 on promotion with a regular price of $2.99
- **THEN** the Giant Eagle row reads "$2.49", is marked as a sale, and shows "was $2.99"

### Requirement: A row compares the price with the store's usual

When the price differs from the store's typical 90-day price by at least the
currency's smallest coin, the row SHALL show the usual price. When the price is
current, below the usual and the lowest of the period, the row SHALL say so.

#### Scenario: Below the usual and the lowest

- **WHEN** ALDI's current price is $1.99, its typical price $2.39 and its lowest $1.99 over 90 days
- **THEN** the ALDI row shows "Usually $2.39" and "Lowest in 90 days"

#### Scenario: At the usual

- **WHEN** a store's price equals its typical price
- **THEN** the row shows no "Usually" line

### Requirement: A short price history is marked as such

When fewer than 30 days of the period had a price, the usual price SHALL state
how many days it is based on, and the low SHALL name that span.

#### Scenario: First collected eleven days ago

- **WHEN** a store's price is $1.29, its typical price $1.49, and 11 days had a price
- **THEN** the row shows "Usually $1.49 over 11 days"

### Requirement: A stale price says when it was last seen

A row whose price is not current SHALL state the date the store last listed it.
It SHALL NOT be marked as the cheapest or as the lowest of the period.

#### Scenario: Last listed eleven days ago

- **WHEN** Kroger last listed garlic on 16 October and today is 27 October
- **THEN** the Kroger row reads "Last seen Oct 16"

### Requirement: The cheapest current store is marked

The first row SHALL be marked "Cheapest" when its price is current and the
section has at least one other row. No other row SHALL be marked.

#### Scenario: Two current stores

- **WHEN** ALDI ($1.99) and Kroger ($2.79) both have current prices
- **THEN** the ALDI row is marked "Cheapest" and the Kroger row is not

#### Scenario: One store

- **WHEN** only Kroger has a price for the item
- **THEN** no row is marked "Cheapest"

#### Scenario: Only stale prices

- **WHEN** no store's price is current
- **THEN** no row is marked "Cheapest"

### Requirement: The list's store is tagged

When the shopping list has a store it is shopped at, that store's row SHALL be
tagged as the list's store, on the item detail and on the store-mode scan card.

#### Scenario: Shopping at Giant Eagle

- **WHEN** the list is shopped at Giant Eagle and ALDI is cheaper
- **THEN** the ALDI row is marked "Cheapest" and the Giant Eagle row is tagged as the list's store

#### Scenario: List with no store

- **WHEN** the list names no store
- **THEN** no row is tagged as the list's store

### Requirement: Amounts read in their own currency

Every amount in a row SHALL be formatted in that row's currency with its
currency's number of decimal places, never assumed to be US dollars.

#### Scenario: A zero-decimal currency

- **WHEN** a row's currency is JPY and its price 298
- **THEN** the row reads "¥298", with no decimal places

### Requirement: The row shows the store's aisle

When the store states where it shelves the item, the row SHALL show that aisle
as the store words it.

#### Scenario: Aisle stated

- **WHEN** Giant Eagle shelves the item in "Aisle 12"
- **THEN** the Giant Eagle row shows "Aisle 12"

### Requirement: Prices off shows and asks for no shelf price

With Settings → Budget & prices off, neither surface SHALL show the section or
request store prices.

#### Scenario: Prices off on the item detail

- **WHEN** Budget & prices is off and the user opens a line whose item has store prices
- **THEN** no "Prices at stores" section is shown and no store-price request is sent

#### Scenario: Prices off in store mode

- **WHEN** Budget & prices is off and the user scans in store mode
- **THEN** the scan card shows no "Prices at stores" section

### Requirement: The build flag switches the section off

A build or fork with the store shelf prices feature flag off SHALL render both
surfaces as they were before this capability, and request no store prices.

#### Scenario: Flag off

- **WHEN** the build sets the store shelf prices flag off and Budget & prices is on
- **THEN** the item detail and the store-mode scan card show no "Prices at stores" section and send no store-price request

### Requirement: Store prices read offline from the last answer

Store prices the device has received SHALL show offline as they were last
received, stale dates included. A failed or never-answered request SHALL leave
the section absent, with no error shown in it.

#### Scenario: Offline after a visit

- **WHEN** the user viewed an item's store prices online, goes offline and opens the item again
- **THEN** the section shows the same rows

#### Scenario: Request fails

- **WHEN** the store-price request fails and nothing is cached
- **THEN** the item detail shows no section and no error in its place
