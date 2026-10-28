# Spec Delta

## Purpose

Defines how the toast after a reviewed cook counts the ingredients deducted
from the pantry and the ones the server could not deduct.

## ADDED Requirements

### Requirement: Each skipped deduction counts against its own entry

Each skip the server reports SHALL count against a distinct entry of the cook,
paired by the stack's name and its units, so two entries drawn from stacks
with the same name count as two skips. A skip that matches no entry SHALL still
count.

#### Scenario: Two ingredients from same-named stacks are both skipped

- **WHEN** a cook draws butter for the dough and for the topping from two stacks named "Butter"
- **AND** the server skips both
- **THEN** the toast reports 0 deducted and 2 not deducted

#### Scenario: One of two same-named entries is skipped

- **WHEN** two entries draw from stacks named "Butter" and the server skips one
- **THEN** the toast reports 1 deducted and 1 not deducted

#### Scenario: A skip no entry claims

- **WHEN** the server reports a skip whose stack name and units match no entry
- **THEN** it is still counted as not deducted

#### Scenario: A substitute's parts

- **WHEN** one ingredient is drawn as several entries of a substitute and one part is skipped
- **THEN** that ingredient counts once as not deducted
