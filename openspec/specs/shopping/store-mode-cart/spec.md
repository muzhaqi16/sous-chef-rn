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
