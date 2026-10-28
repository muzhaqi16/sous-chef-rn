# shopping/store-mode-cart Specification

## Purpose
Defines how a product scanned in store mode reaches the cart: the list line
it fulfils, the line an add lands on, and a tick that only ever puts a line in
the cart.

## Requirements

### Requirement: A scan ticks the line its add landed on

When a store-mode scan adds a product the list does not show as open, the
system SHALL tick the line the server's answer names. If the server merged the
add into an existing line, that line is ticked, not the row the device created
for the add.

#### Scenario: The server merges the add into a line the device had not loaded

- **WHEN** a product is scanned in store mode and no cached line matches it
- **AND** the add's response names an existing line Y instead of the new row
- **THEN** line Y is in the cart and the scan reports it added

#### Scenario: The add is queued offline

- **WHEN** a product is scanned in store mode offline and no line matches it
- **THEN** the new row the device created is ticked and the tick queues with it

#### Scenario: The add is refused

- **WHEN** the add is refused
- **THEN** nothing is ticked and the user is told the add failed

### Requirement: A store-mode tick only puts a line in the cart

A tick from store mode SHALL mark its line purchased. It SHALL NOT mark it
unpurchased, whatever the cached line says or however many times it is sent.

#### Scenario: The line was already ticked by another member

- **WHEN** a store-mode scan ticks a line whose cached state is already purchased
- **THEN** the line stays purchased and its recorded purchase is kept

#### Scenario: The same tick is sent twice

- **WHEN** a store-mode tick without a price is sent for a line, then sent again (a retry or a replay)
- **THEN** the line ends purchased, and the second tick writes nothing on the server

### Requirement: Store mode offers no second add while one is in flight

While a store-mode add is in flight, the system SHALL disable the "Add with
price" action, as it disables the primary add.

#### Scenario: Price action during an add

- **WHEN** "Add to cart" is in flight
- **THEN** "Add with price" is shown disabled and opens nothing when pressed

### Requirement: A failed add with its price keeps the price sheet

When the user adds a scanned product with its price and the product does not
end up in the cart, the system SHALL keep the price sheet open with what the
user typed, and SHALL tell the user the add failed. Every way the add can
fail SHALL say so; none ends silently.

#### Scenario: The tick is refused

- **WHEN** the user types a price for an unlisted product and confirms
- **AND** the line is added but the server refuses the tick
- **THEN** the sheet stays open with the typed quantity and price, and the user is told the add failed

#### Scenario: The tick cannot be sent

- **WHEN** the user confirms a price and the added line cannot be ticked on the device, so no tick is sent
- **THEN** the user is told the add failed, and the sheet stays open with what they typed

#### Scenario: The add itself fails

- **WHEN** the user confirms a price and the product cannot be added as a line
- **THEN** the sheet stays open with what they typed, and the user is told the add failed

#### Scenario: The add and tick succeed

- **WHEN** the user confirms a price and the line is added and ticked
- **THEN** the sheet closes and the scan reports the product added

### Requirement: The scan card's cart lookup never asks the network

The scan card SHALL find the line a scan fulfils, and whether the product is
already in the cart, only from the lines store mode already holds. Looking it
up, a resync while the card is open, and an incomplete read SHALL send no
request for the list's lines.

#### Scenario: A resync with the scan card open

- **WHEN** store mode has loaded every line of a long list and a scan card is open
- **AND** a resync runs
- **THEN** the card's lookup sends no request, and store mode still holds every line it loaded

#### Scenario: No signal on the shelf

- **WHEN** the device is offline and the user scans a product on the list in store mode
- **THEN** the card finds the line from what store mode holds
