# sync/foreground-resync Specification

## Purpose
Decides when a return to the app re-asks the server for what is on screen, so
changes made while the device was away reach it even when the live-event
channel looks open but has stopped delivering.

## Requirements

### Requirement: A return after the server's liveness window resyncs

When the app becomes active after being inactive or in the background for at
least the server's socket liveness window (two server ping intervals, 60 s at
the API's default), the system SHALL resync what is on screen, whether or not
the live channel reads open.

#### Scenario: Away longer than the liveness window, socket still reads open

- **WHEN** the app returns to active after 90 s in the background
- **AND** no close event was delivered for the socket, so the channel reads open
- **THEN** a foreground resync is emitted

#### Scenario: Away longer than the liveness window, socket closed

- **WHEN** the app returns to active after 90 s in the background
- **AND** the channel reads closed
- **THEN** a foreground resync is emitted

### Requirement: A short return over an open channel does not resync

When the app becomes active after an absence shorter than the server's
liveness window and the live channel reads open, the system SHALL NOT emit a
foreground resync. The channel's own reconnect still resyncs if the socket
turns out to have dropped.

#### Scenario: Brief trip to another app

- **WHEN** the app returns to active after 10 s in the background
- **AND** the channel reads open
- **THEN** no foreground resync is emitted

#### Scenario: Brief absence with the channel closed

- **WHEN** the app returns to active after 10 s in the background
- **AND** the channel reads closed
- **THEN** a foreground resync is emitted

#### Scenario: The socket's close arrives after the return

- **WHEN** the app returns to active after 10 s with the channel reading open
- **AND** the socket then closes and reconnects
- **THEN** the reconnect emits its own resync
