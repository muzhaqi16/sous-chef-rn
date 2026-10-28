# Spec Delta

## MODIFIED Requirements

### Requirement: A return after the server's liveness window resyncs

When the app becomes active after being inactive or in the background for at
least the server's socket liveness window (one server ping interval, 30 s at
the API's default: the server can end a socket that missed one ping at its
very next tick), the system SHALL resync what is on screen, whether or not
the live channel reads open.

#### Scenario: Away longer than the liveness window, socket still reads open

- **WHEN** the app returns to active after 90 s in the background
- **AND** no close event was delivered for the socket, so the channel reads open
- **THEN** a foreground resync is emitted

#### Scenario: Away longer than the liveness window, socket closed

- **WHEN** the app returns to active after 90 s in the background
- **AND** the channel reads closed
- **THEN** a foreground resync is emitted

#### Scenario: Away between one and two ping intervals, socket still reads open

- **WHEN** the app returns to active after 40 s in the background
- **AND** no close event was delivered for the socket, so the channel reads open
- **THEN** a foreground resync is emitted, since the server may already have ended the socket
