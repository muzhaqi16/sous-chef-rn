# barcode/scan-price-memory Specification

## Purpose
Defines the price lines a store-mode scan card shows from what the household
paid before and what the list's store usually charges, how a typed price is
compared with them, and when the card shows no money at all.

## Requirements

### Requirement: A typed price is compared with the usual only in one currency

When the user types what a scanned product costs, the card SHALL compare it
with the household's usual price only when both are in the same currency.
Otherwise it SHALL show no comparison.

#### Scenario: The list and the household history share a currency

- **WHEN** the list is kept in EUR, the household's usual is €2.50 per unit, and the user types €2.00 for one unit
- **THEN** the card says the price is €0.50 below the usual €2.50

#### Scenario: The currencies differ

- **WHEN** the list is kept in EUR and the household's usual is stated in USD
- **THEN** typing a price shows no comparison with the usual

### Requirement: Prices off, the scan card shows no money

With Budget & prices off, the store-mode scan card SHALL show no last-paid,
usual or typical price line, including when prices are switched off while the
card is open.

#### Scenario: Prices switched off with the card open

- **WHEN** a store-mode scan card shows the store's typical price
- **AND** the user switches Budget & prices off without leaving the card
- **THEN** the card shows no typical, usual or last-paid price line

#### Scenario: Prices off before the scan

- **WHEN** Budget & prices is off and the user scans a product in store mode
- **THEN** the card shows no price line
