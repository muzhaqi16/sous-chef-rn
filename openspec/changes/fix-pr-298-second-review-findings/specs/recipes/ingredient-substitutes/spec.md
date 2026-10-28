# Spec Delta

## Purpose

Defines which swaps a recipe's ingredient offers when the household's dietary
needs flag it, and makes sure the swaps shown are always for the current
household.

## ADDED Requirements

### Requirement: Swaps are for the current household only

A recipe SHALL offer swaps for an ingredient only from an answer for the
current home while the ingredient is flagged. When the user has no current
home, or no ingredient is flagged any more, no swap SHALL be shown, including
on a swaps sheet that is already open.

#### Scenario: The user leaves the home with the swaps sheet open

- **WHEN** a recipe's swaps sheet is open for a flagged ingredient
- **AND** the user leaves, or is removed from, their home
- **THEN** the sheet shows no swaps and none of the old home's alerts

#### Scenario: The flag goes away with the sheet open

- **WHEN** a recipe's swaps sheet is open for a flagged ingredient
- **AND** the household's dietary needs change so that no ingredient is flagged
- **THEN** the sheet shows no swaps

#### Scenario: Another home is selected

- **WHEN** the user switches to another home that flags the same ingredient
- **THEN** the swaps shown are the new home's, never the previous home's while the new answer loads
