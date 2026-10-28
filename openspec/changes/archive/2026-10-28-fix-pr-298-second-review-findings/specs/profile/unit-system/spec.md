# Spec Delta

## Purpose

Defines which unit system amounts read in, from the user's setting or, for
"Device default", from what the server says the device's locale means, and
keeps that answer readable while either changes.

## ADDED Requirements

### Requirement: A locale change never shows amounts in the wrong system meanwhile

When the device registers a new locale, amounts and amount fields SHALL keep
reading in the current system until the server's new answer for the device
arrives, then follow it. A user who chose metric or imperial SHALL never see
the other system because of a locale change.

#### Scenario: An imperial user's first registration of a session

- **WHEN** a user whose setting is IMPERIAL opens the app and the device registers its locale
- **THEN** every amount on screen reads in imperial throughout, and a pantry or scan form opened meanwhile seeds imperial units

#### Scenario: "Device default" and the locale moves to an imperial region

- **WHEN** a user on "Device default" changes the device's region from Germany to the United States
- **AND** the device registers the new locale
- **THEN** amounts read in metric until the server's answer arrives, then in imperial

#### Scenario: The app is closed before the answer arrives

- **WHEN** the device registers a new locale and the app is closed before the server answers
- **THEN** the next cold start, online or offline, reads amounts in the last known system
