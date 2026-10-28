# Spec Delta

## Purpose

Defines what creating a shopping list with starting lines (a copy, or a list
generated from a meal plan) leaves on the device when the create is sent,
queued or refused.

## ADDED Requirements

### Requirement: A starting-lines write that fails does not strand the list

If writing a new list's starting lines to the device fails, the system SHALL
report the failure and still send the create. It SHALL NOT leave a local list
whose create never leaves the device.

#### Scenario: One derived line cannot be written

- **WHEN** a list is copied and writing one of its lines to the cache throws
- **THEN** the create is still sent with its lines
- **AND** the failure is reported to error tracking

### Requirement: A refused create takes its starting lines with it

When the server refuses a list create, the system SHALL remove the list and
every starting line the device wrote for it.

#### Scenario: Create refused with a conflict

- **WHEN** a list generated from a meal plan with 60 lines is refused
- **THEN** neither the list nor any of its 60 lines remains in the cache
