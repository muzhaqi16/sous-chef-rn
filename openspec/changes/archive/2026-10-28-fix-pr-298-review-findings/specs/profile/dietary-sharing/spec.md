# Spec Delta

## Purpose

Defines what the per-home dietary sharing switch shows after the server
refuses a toggle, so the switch always ends where the server holds it.

## ADDED Requirements

### Requirement: A refused toggle shows the server's state

When the server refuses a sharing toggle, the system SHALL show the
membership's sharing as the server holds it. It SHALL NOT invert the refused
value over a later toggle.

#### Scenario: The first of three quick toggles is refused last

- **WHEN** the user toggles sharing off, on and off in quick succession
- **AND** the first toggle's refusal arrives after the third was applied
- **THEN** the switch shows off, as the server holds it

#### Scenario: A single toggle is refused

- **WHEN** the user turns sharing on and the server refuses it
- **THEN** the switch shows off and the refusal is shown as a toast

#### Scenario: A toggle queues offline

- **WHEN** the user turns sharing on offline
- **THEN** the switch shows on and the write replays when the API is reachable
