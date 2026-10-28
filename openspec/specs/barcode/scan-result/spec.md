# barcode/scan-result Specification

## Purpose
Defines what the scan result card shows about a scanned product (its
brand-list matches, the pantry stack an add joins, its origin and price lines)
and how often showing it asks the server.

## Requirements

### Requirement: Brand-list matches follow the user's lists

The card SHALL show a brand-list match only while the user's lists hold it: the
list still exists, is switched on, and still holds the entry the match names.
Deleting a list or removing a brand from one SHALL take its match off the card
at once, offline included.

#### Scenario: A list is deleted from the scan result

- **WHEN** the card shows "On list Avoid" and the user deletes the list Avoid
- **THEN** the card no longer shows Avoid when they return to it

#### Scenario: A brand is removed from a list

- **WHEN** the user removes the scanned brand from the list Avoid
- **THEN** the card no longer shows Avoid

#### Scenario: Offline re-scan after a delete

- **WHEN** the user deletes the list Avoid offline and scans the same product again
- **THEN** the card does not show Avoid

#### Scenario: Lists not loaded yet

- **WHEN** the user's lists have never been read on this device
- **THEN** the card shows the matches the product lookup returned

### Requirement: The joined-stack summary names one stack

The stack whose amount the "adds to your …" summary shows SHALL be the one
whose unit the add is counted in. It is picked as the API picks the stack a
forced add joins: the held stack in the add's unit, else the oldest.

#### Scenario: Two stacks of the product, one with an incomplete cached row

- **WHEN** the pantry holds a counted stack whose cached row is incomplete, and a complete weighed stack
- **THEN** the summary does not show the weighed stack's amount next to the counted unit

#### Scenario: One complete stack

- **WHEN** the pantry holds one complete stack of the product in cans
- **THEN** the summary reads "Adds 1 can to your 2 cans"

### Requirement: The held stack follows the pantry while the card is open

The card's "creates a new stack" and joined-stack summary SHALL reflect the
pantry as the cache holds it now, not as it was when the card opened. The
amount the user has typed SHALL NOT be reset.

#### Scenario: The pantry finishes loading after the card opens

- **WHEN** the card opens before the pantry's rows are cached, then they load holding a stack of the product
- **THEN** the card stops saying the add creates a stack, and the typed amount is kept

### Requirement: A scan reads its brand lists and store prices from the cache first

The scan card SHALL read the user's brand lists and the store price comparison
from the cache when they are there. It SHALL NOT send a network request for
them on every scan.

#### Scenario: Twenty scans in a row

- **WHEN** the user scans 20 products in a row with the brand lists already cached
- **THEN** no BrandLists request is sent for those scans

#### Scenario: The same product scanned twice in store mode

- **WHEN** the same product is scanned twice in store mode
- **THEN** the second scan sends no StorePriceComparison request

### Requirement: A value newer than the build renders as unknown, never blank

A price basis or data source the build does not know SHALL render a fallback:
the price with no basis, and a line with no source name. It SHALL NOT render
an empty label.

#### Scenario: Unknown price basis

- **WHEN** a price arrives with a basis this build's enum lacks
- **THEN** the price line shows the price, never an empty label

#### Scenario: Unknown external source

- **WHEN** an origin fact or brand owner arrives with a source this build's enum lacks
- **THEN** the line is shown with no source name
