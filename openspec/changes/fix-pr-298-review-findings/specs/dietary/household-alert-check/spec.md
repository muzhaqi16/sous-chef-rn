# Spec Delta

## Purpose

Defines how the household dietary check on a product or recipe says whether
the alerts it shows are a current answer from the server or an earlier one.

## ADDED Requirements

### Requirement: An answer shown beside an error is shown as stale

When the check shows an answer and the query that produced or refreshed it
reported an error, the system SHALL report the check as stale, as it does
offline. It SHALL NOT report it as checked.

#### Scenario: The answer carries errors beside its data

- **WHEN** a recipe's alerts arrive with GraphQL errors beside their data
- **THEN** the alerts are shown with "Checked earlier; this may be out of date."

#### Scenario: Refresh succeeds

- **WHEN** a recipe's alerts are cached and the refresh answers
- **THEN** the check is reported as checked, with no stale caption

#### Scenario: Offline with an earlier answer

- **WHEN** the API is unavailable and an earlier answer is cached
- **THEN** the check is reported as stale

#### Scenario: Failed with no earlier answer

- **WHEN** no answer is cached and the request fails online
- **THEN** the check is reported as failed and never as "nothing found"
