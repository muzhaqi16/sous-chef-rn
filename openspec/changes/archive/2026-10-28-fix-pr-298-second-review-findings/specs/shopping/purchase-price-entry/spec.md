# Spec Delta

## Purpose

Defines what the purchase amount sheet asks for when the user records what
they bought and paid, and how it labels the amount they type.

## ADDED Requirements

### Requirement: The total paid is labelled in the list's currency

The sheet's total-paid field SHALL be labelled with the symbol of the
currency the price is recorded in: the list's currency, else the user's
preferred one. It SHALL NOT assume US dollars.

#### Scenario: A list kept in euros

- **WHEN** the user records a purchase on a list whose currency is EUR
- **THEN** the total-paid field is labelled "€"

#### Scenario: A list with no currency of its own

- **WHEN** the list states no currency and the user's preferred currency is ALL
- **THEN** the total-paid field is labelled with the lek's symbol, as the device's locale writes it

#### Scenario: The same sheet in store mode

- **WHEN** the user adds a scanned product with its price in store mode on a list kept in EUR
- **THEN** the total-paid field is labelled "€"
