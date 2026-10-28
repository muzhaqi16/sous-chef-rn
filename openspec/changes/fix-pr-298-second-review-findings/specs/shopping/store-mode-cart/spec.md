# Spec Delta

## ADDED Requirements

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
