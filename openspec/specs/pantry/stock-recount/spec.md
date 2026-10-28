# pantry/stock-recount Specification

## Purpose
Defines what a pantry recount that the server refuses puts back on the device,
so a refusal never overwrites stock the cache received after the recount was
sent.

## Requirements

### Requirement: A refused recount puts back only what it wrote

When the server refuses a recount, the system SHALL undo only the values the
recount itself wrote ahead. A recount that wrote nothing ahead SHALL leave the
cached stack as it is.

#### Scenario: Recount in another unit is refused after a member's use arrives

- **WHEN** a stack held in g is recounted in lb, so nothing is written ahead
- **AND** another member's use updates the stack while the recount is in flight
- **AND** the server refuses the recount
- **THEN** the stack shows the amount and version from the member's use

#### Scenario: Recount in the stack's unit is refused

- **WHEN** a stack is recounted in its own unit, written ahead, and refused
- **THEN** the stack's amount returns to what it was before the recount
