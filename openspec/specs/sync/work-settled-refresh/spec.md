# sync/work-settled-refresh Specification

## Purpose
Defines how a screen waiting on server work, such as a receipt parse or a
recipe capture, shows the settled state once the server announces that the
work has settled.

## Requirements

### Requirement: A settled event is answered by a request sent after it

When the server announces that work a screen is waiting on has settled, the
system SHALL re-ask for that work with a request sent after the announcement.
It SHALL NOT reuse a request that was already in flight when the announcement
arrived, since that request can return the state from before the work
settled.

#### Scenario: A receipt parse settles while a safety poll is in flight

- **WHEN** a receipt parse is being polled over an open live channel
- **AND** the parse's settled event arrives while a poll request is in flight
- **THEN** a new request is sent for the parse, and the screen shows the settled parse from its answer without waiting for the next poll

#### Scenario: A recipe capture settles while a poll is in flight

- **WHEN** a recipe capture is being polled
- **AND** the capture's settled event arrives while a poll request is in flight
- **THEN** a new request is sent for the capture, and the screen shows the settled capture from its answer

#### Scenario: A settled event with no poll in flight

- **WHEN** the settled event arrives between polls
- **THEN** one request is sent for the work, and the screen shows its answer
