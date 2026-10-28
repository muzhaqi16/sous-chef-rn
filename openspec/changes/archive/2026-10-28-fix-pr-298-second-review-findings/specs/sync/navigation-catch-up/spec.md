# Spec Delta

## Purpose

Decides when a navigation after a resync or a language switch re-asks the
server for what is on screen, and when it can tell nothing is left to re-ask
and touches neither the offline queue nor the network.

## ADDED Requirements

### Requirement: A catch-up with nothing left to re-ask does nothing

After a navigation, when every on-screen query that a refetch would send has
been answered since the last resync or switch, the system SHALL NOT drain the
offline queue or send a request. A query held to the cache, which a refetch
never sends, SHALL NOT count as left to re-ask.

#### Scenario: A held cache read is on screen

- **WHEN** a resync has run and the user navigates to a screen where every network-backed query has been answered since
- **AND** a query on that screen is held to the cache, so a refetch never sends it
- **THEN** the navigation drains nothing and sends no request

#### Scenario: A query really is left to re-ask

- **WHEN** a resync has run and the user navigates to a screen with a network-backed query not answered since
- **THEN** that query is re-asked once the offline queue is idle

### Requirement: No catch-up while the network is withheld

While no request may reach the server, because offline mode is on or the API
is unavailable, a navigation SHALL NOT run a catch-up: it neither drains the
queue nor refetches on-screen queries from the cache.

#### Scenario: Offline mode is on

- **WHEN** offline mode is on and the user navigates after a resync
- **THEN** the queue is not drained and no on-screen query is refetched

#### Scenario: Offline mode is turned off

- **WHEN** offline mode is turned off with queries left to re-ask
- **THEN** the next catch-up re-asks them

### Requirement: A read that another query owns never asks the network

A watcher that only reads what another query fetched SHALL never send a
request of its own, on mount, on an incomplete read or during a resync.

#### Scenario: A resync while the current home is shown

- **WHEN** a resync runs while a screen reads the current home
- **THEN** the current-home read is not refetched, and the home follows the homes query that owns the fetch

#### Scenario: The homes list leaves the cache

- **WHEN** the cached homes list becomes incomplete while a screen reads the current home
- **THEN** the current-home read sends no request of its own
